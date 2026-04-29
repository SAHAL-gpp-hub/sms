"""add_exam_subject_configs

Adds a per-exam subject configuration table so marks can use custom
max_theory / max_practical values that override the subject defaults.

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-04-28
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    return table in inspector.get_table_names()


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def upgrade() -> None:
    # ── exam_subject_configs ─────────────────────────────────────────────
    # Stores per-exam overrides for max_theory / max_practical per subject.
    # If a row exists here, marks_service uses these values instead of the
    # subject-level defaults. This allows "Unit Test 1 = 25 marks" while
    # the subject still has max_theory = 100 for annual exams.
    if not _table_exists("exam_subject_configs"):
        op.create_table(
            "exam_subject_configs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("exam_id", sa.Integer(), nullable=False),
            sa.Column("subject_id", sa.Integer(), nullable=False),
            sa.Column("max_theory", sa.Integer(), nullable=False),
            sa.Column("max_practical", sa.Integer(), nullable=False, server_default="0"),
            sa.ForeignKeyConstraint(["exam_id"], ["exams.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("exam_id", "subject_id", name="uq_exam_subject_config"),
        )
        op.create_index(
            "ix_exam_subject_configs_exam_id",
            "exam_subject_configs",
            ["exam_id"],
        )

    # ── subjects: add is_active if missing ──────────────────────────────
    if not _column_exists("subjects", "is_active"):
        op.add_column(
            "subjects",
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        )


def downgrade() -> None:
    if _table_exists("exam_subject_configs"):
        op.drop_index("ix_exam_subject_configs_exam_id", "exam_subject_configs")
        op.drop_table("exam_subject_configs")

    if _column_exists("subjects", "is_active"):
        op.drop_column("subjects", "is_active")