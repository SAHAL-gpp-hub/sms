"""add_academic_year_id_to_student_fees_and_rename_aadhar_to_last4

This migration consolidates two schema changes that were previously in
migration 384df2f48f9d. It uses IF NOT EXISTS / IF EXISTS guards so it is
safe to run on databases that already have these columns from a previous
migration, and also safe to run on a fresh database.

Changes:
  1. students.aadhar_last4 — add if not exists (was: aadhar VARCHAR(12))
  2. students.aadhar — drop if exists (renamed to aadhar_last4)
  3. student_fees.academic_year_id — add if not exists with FK to academic_years

Revision ID: 384df2f48f9d
Revises: None
Create Date: 2026-04-11 (updated with guards 2026-04-15)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = '384df2f48f9d'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    """Return True if the column already exists in the table."""
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def upgrade() -> None:
    # ── students: rename aadhar → aadhar_last4 ────────────────────────────
    # Step 1: add the new column if it doesn't exist
    if not _column_exists("students", "aadhar_last4"):
        op.add_column(
            "students",
            sa.Column("aadhar_last4", sa.String(length=4), nullable=True),
        )

    # Step 2: migrate data — copy last 4 chars of any existing aadhar value
    if _column_exists("students", "aadhar"):
        op.execute(
            """
            UPDATE students
            SET aadhar_last4 = RIGHT(aadhar, 4)
            WHERE aadhar IS NOT NULL
              AND aadhar_last4 IS NULL
            """
        )
        # Step 3: drop the old column
        op.drop_column("students", "aadhar")

    # ── student_fees: add academic_year_id ───────────────────────────────
    # This is the critical missing column — fee_service.py writes and filters
    # by this column; without it every /fees/assign call crashed with
    # AttributeError: type object 'StudentFee' has no attribute 'academic_year_id'
    if not _column_exists("student_fees", "academic_year_id"):
        op.add_column(
            "student_fees",
            sa.Column("academic_year_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_student_fees_academic_year_id",
            "student_fees",
            "academic_years",
            ["academic_year_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    # Reverse: drop academic_year_id from student_fees
    if _column_exists("student_fees", "academic_year_id"):
        op.drop_constraint(
            "fk_student_fees_academic_year_id",
            "student_fees",
            type_="foreignkey",
        )
        op.drop_column("student_fees", "academic_year_id")

    # Reverse: restore aadhar column (data is lost — last4 only)
    if not _column_exists("students", "aadhar"):
        op.add_column(
            "students",
            sa.Column("aadhar", sa.VARCHAR(length=12), nullable=True),
        )
    if _column_exists("students", "aadhar_last4"):
        op.drop_column("students", "aadhar_last4")
