"""add_unique_constraints_and_token_blocklist

Changes:
  1. marks: add UNIQUE(student_id, subject_id, exam_id)
  2. attendance: add UNIQUE(student_id, class_id, date)
  3. token_blocklist: new table for JWT revocation (logout support)

Revision ID: a1b2c3d4e5f6
Revises: 384df2f48f9d
Create Date: 2026-04-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "384df2f48f9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _constraint_exists(table: str, constraint_name: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    constraints = inspector.get_unique_constraints(table)
    return any(c["name"] == constraint_name for c in constraints)


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    return table in inspector.get_table_names()


def upgrade() -> None:
    # ── marks: unique constraint ─────────────────────────────────────────
    if not _constraint_exists("marks", "uq_mark_student_subject_exam"):
        op.create_unique_constraint(
            "uq_mark_student_subject_exam",
            "marks",
            ["student_id", "subject_id", "exam_id"],
        )

    # ── attendance: unique constraint ────────────────────────────────────
    if not _constraint_exists("attendance", "uq_attendance_student_class_date"):
        op.create_unique_constraint(
            "uq_attendance_student_class_date",
            "attendance",
            ["student_id", "class_id", "date"],
        )

    # ── token_blocklist table ─────────────────────────────────────────────
    if not _table_exists("token_blocklist"):
        op.create_table(
            "token_blocklist",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("jti", sa.String(length=36), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("jti"),
        )
        op.create_index("ix_token_blocklist_jti", "token_blocklist", ["jti"])


def downgrade() -> None:
    # ── token_blocklist ───────────────────────────────────────────────────
    if _table_exists("token_blocklist"):
        op.drop_index("ix_token_blocklist_jti", table_name="token_blocklist")
        op.drop_table("token_blocklist")

    # ── attendance ────────────────────────────────────────────────────────
    if _constraint_exists("attendance", "uq_attendance_student_class_date"):
        op.drop_constraint(
            "uq_attendance_student_class_date", "attendance", type_="unique"
        )

    # ── marks ─────────────────────────────────────────────────────────────
    if _constraint_exists("marks", "uq_mark_student_subject_exam"):
        op.drop_constraint(
            "uq_mark_student_subject_exam", "marks", type_="unique"
        )
