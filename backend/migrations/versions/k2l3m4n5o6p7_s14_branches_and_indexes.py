"""s14 branches foundation and perf indexes

Revision ID: k2l3m4n5o6p7
Revises: j1k2l3m4n5o6
Create Date: 2026-05-10 10:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k2l3m4n5o6p7"
down_revision: Union[str, None] = "j1k2l3m4n5o6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "branches",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("gseb_affiliation_no", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
    )
    op.execute(
        """
        INSERT INTO branches (id, name)
        VALUES (1, 'Iqra English Medium School — Main Campus')
        ON CONFLICT (id) DO NOTHING
        """
    )

    op.add_column("academic_years", sa.Column("branch_id", sa.Integer(), nullable=True))
    op.add_column("classes", sa.Column("branch_id", sa.Integer(), nullable=True))
    op.add_column("students", sa.Column("branch_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("branch_id", sa.Integer(), nullable=True))

    op.create_index("ix_academic_years_branch_id", "academic_years", ["branch_id"], unique=False)
    op.create_index("ix_classes_branch_id", "classes", ["branch_id"], unique=False)
    op.create_index("ix_students_branch_id", "students", ["branch_id"], unique=False)
    op.create_index("ix_users_branch_id", "users", ["branch_id"], unique=False)

    op.create_foreign_key("fk_academic_years_branch_id", "academic_years", "branches", ["branch_id"], ["id"])
    op.create_foreign_key("fk_classes_branch_id", "classes", "branches", ["branch_id"], ["id"])
    op.create_foreign_key("fk_students_branch_id", "students", "branches", ["branch_id"], ["id"])
    op.create_foreign_key("fk_users_branch_id", "users", "branches", ["branch_id"], ["id"])

    op.execute("CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_marks_exam_student ON marks(exam_id, student_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_students_class_year ON students(class_id, academic_year_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fee_payments_date ON fee_payments(payment_date)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_fee_payments_date")
    op.execute("DROP INDEX IF EXISTS idx_students_class_year")
    op.execute("DROP INDEX IF EXISTS idx_student_fees_student")
    op.execute("DROP INDEX IF EXISTS idx_marks_exam_student")
    op.execute("DROP INDEX IF EXISTS idx_attendance_class_date")

    op.drop_constraint("fk_users_branch_id", "users", type_="foreignkey")
    op.drop_constraint("fk_students_branch_id", "students", type_="foreignkey")
    op.drop_constraint("fk_classes_branch_id", "classes", type_="foreignkey")
    op.drop_constraint("fk_academic_years_branch_id", "academic_years", type_="foreignkey")

    op.drop_index("ix_users_branch_id", table_name="users")
    op.drop_index("ix_students_branch_id", table_name="students")
    op.drop_index("ix_classes_branch_id", table_name="classes")
    op.drop_index("ix_academic_years_branch_id", table_name="academic_years")

    op.drop_column("users", "branch_id")
    op.drop_column("students", "branch_id")
    op.drop_column("classes", "branch_id")
    op.drop_column("academic_years", "branch_id")

    op.drop_table("branches")
