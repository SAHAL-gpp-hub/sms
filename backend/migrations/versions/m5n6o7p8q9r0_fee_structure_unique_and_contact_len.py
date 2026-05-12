"""add fee structure unique constraint and widen student contact

Revision ID: m5n6o7p8q9r0
Revises: l4m5n6o7p8q9
Create Date: 2026-05-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "m5n6o7p8q9r0"
down_revision: Union[str, None] = "l4m5n6o7p8q9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    return table in inspect(op.get_bind()).get_table_names()


def _column_exists(table: str, column: str) -> bool:
    if not _table_exists(table):
        return False
    return column in [c["name"] for c in inspect(op.get_bind()).get_columns(table)]


def _unique_exists(table: str, name: str) -> bool:
    if not _table_exists(table):
        return False
    uniques = inspect(op.get_bind()).get_unique_constraints(table)
    return any(u.get("name") == name for u in uniques)


def upgrade() -> None:
    if _table_exists("fee_structures"):
        # Collapse duplicate fee structures before adding uniqueness.
        op.execute(
            """
            WITH duplicate_map AS (
                SELECT
                    id,
                    MIN(id) OVER (
                        PARTITION BY class_id, fee_head_id, academic_year_id
                    ) AS keep_id
                FROM fee_structures
            )
            UPDATE student_fees sf
            SET fee_structure_id = dm.keep_id
            FROM duplicate_map dm
            WHERE sf.fee_structure_id = dm.id
              AND dm.id <> dm.keep_id
            """
        )
        op.execute(
            """
            DELETE FROM fee_structures fs
            USING (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY class_id, fee_head_id, academic_year_id
                        ORDER BY id
                    ) AS rn
                FROM fee_structures
            ) ranked
            WHERE fs.id = ranked.id
              AND ranked.rn > 1
            """
        )
        if not _unique_exists("fee_structures", "uq_fee_structure_class_head_year"):
            op.create_unique_constraint(
                "uq_fee_structure_class_head_year",
                "fee_structures",
                ["class_id", "fee_head_id", "academic_year_id"],
            )

    if _column_exists("students", "contact"):
        with op.batch_alter_table("students", schema=None) as batch_op:
            batch_op.alter_column(
                "contact",
                existing_type=sa.String(length=10),
                type_=sa.String(length=20),
                existing_nullable=False,
            )


def downgrade() -> None:
    if _unique_exists("fee_structures", "uq_fee_structure_class_head_year"):
        op.drop_constraint("uq_fee_structure_class_head_year", "fee_structures", type_="unique")

    if _column_exists("students", "contact"):
        with op.batch_alter_table("students", schema=None) as batch_op:
            batch_op.alter_column(
                "contact",
                existing_type=sa.String(length=20),
                type_=sa.String(length=10),
                existing_nullable=False,
            )
