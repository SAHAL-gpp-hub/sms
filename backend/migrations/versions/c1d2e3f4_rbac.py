"""rbac roles assignments and portal links

Revision ID: c1d2e3f4
Revises: b3c4d5e6f7a8
Create Date: 2026-05-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "c1d2e3f4"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    inspector = inspect(op.get_bind())
    return table in inspector.get_table_names()


def _column_exists(table: str, column: str) -> bool:
    inspector = inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return False
    return column in [c["name"] for c in inspector.get_columns(table)]


def _constraint_exists(table: str, constraint: str) -> bool:
    inspector = inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return False
    checks = inspector.get_check_constraints(table)
    return constraint in [c["name"] for c in checks]


def upgrade() -> None:
    if (
        _table_exists("users")
        and _table_exists("classes")
        and _table_exists("academic_years")
        and _table_exists("subjects")
        and not _table_exists("teacher_class_assignments")
    ):
        op.create_table(
            "teacher_class_assignments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("teacher_id", sa.Integer(), nullable=False),
            sa.Column("class_id", sa.Integer(), nullable=False),
            sa.Column("academic_year_id", sa.Integer(), nullable=False),
            sa.Column("subject_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"]),
            sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
            sa.UniqueConstraint(
                "teacher_id",
                "class_id",
                "academic_year_id",
                "subject_id",
                name="uq_teacher_class_year_subject",
            ),
        )

    if _table_exists("students") and _table_exists("users") and not _column_exists("students", "student_user_id"):
        op.add_column("students", sa.Column("student_user_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_students_student_user_id_users",
            "students",
            "users",
            ["student_user_id"],
            ["id"],
        )

    if _table_exists("students") and _table_exists("users") and not _column_exists("students", "parent_user_id"):
        op.add_column("students", sa.Column("parent_user_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_students_parent_user_id_users",
            "students",
            "users",
            ["parent_user_id"],
            ["id"],
        )

    if _table_exists("users") and not _constraint_exists("users", "users_role_check"):
        op.create_check_constraint(
            "users_role_check",
            "users",
            "role IN ('admin', 'teacher', 'student', 'parent')",
        )


def downgrade() -> None:
    if _constraint_exists("users", "users_role_check"):
        op.drop_constraint("users_role_check", "users", type_="check")

    if _column_exists("students", "parent_user_id"):
        op.drop_constraint("fk_students_parent_user_id_users", "students", type_="foreignkey")
        op.drop_column("students", "parent_user_id")

    if _column_exists("students", "student_user_id"):
        op.drop_constraint("fk_students_student_user_id_users", "students", type_="foreignkey")
        op.drop_column("students", "student_user_id")

    if _table_exists("teacher_class_assignments"):
        op.drop_table("teacher_class_assignments")
