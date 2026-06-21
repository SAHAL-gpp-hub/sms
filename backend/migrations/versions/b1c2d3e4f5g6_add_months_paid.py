"""add months_paid, drop installment_plan and installments_paid

Flexible month-based fee payment system. Replaces the fixed full/half/quarter
installment-plan-locking model with a single `months_paid` counter
(0, 3, 6, 9, or 12) that lets parents/admins pay any valid month grouping at
any time without locking a plan.

Revision ID: b1c2d3e4f5g6
Revises: q1a2b3c4d5e6f
Create Date: 2026-06-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c2d3e4f5g6"
down_revision: Union[str, None] = "q1a2b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return any(col["name"] == column for col in sa.inspect(bind).get_columns(table))


def upgrade() -> None:
    # Step 1: Add months_paid with default 0
    if not _column_exists("student_fees", "months_paid"):
        op.add_column(
            "student_fees",
            sa.Column("months_paid", sa.Integer(), nullable=False, server_default="0"),
        )

    # Step 2: Backfill from installment_plan + installments_paid
    op.execute(
        """
        UPDATE student_fees
        SET months_paid = CASE
            WHEN installment_plan = 'full'    AND installments_paid >= 1 THEN 12
            WHEN installment_plan = 'half'    AND installments_paid = 1  THEN 6
            WHEN installment_plan = 'half'    AND installments_paid >= 2 THEN 12
            WHEN installment_plan = 'quarter' AND installments_paid = 1  THEN 3
            WHEN installment_plan = 'quarter' AND installments_paid = 2  THEN 6
            WHEN installment_plan = 'quarter' AND installments_paid = 3  THEN 9
            WHEN installment_plan = 'quarter' AND installments_paid >= 4 THEN 12
            ELSE 0
        END
        """
    )

    # Step 3: Safety net — rows where payments sum to >= net_amount but months_paid
    # is still 0 (e.g. legacy custom-amount payments with no plan set). Mark fully paid.
    op.execute(
        """
        UPDATE student_fees sf
        SET months_paid = 12
        WHERE sf.months_paid = 0
        AND sf.net_amount > 0
        AND (
            SELECT COALESCE(SUM(fp.amount_paid), 0)
            FROM fee_payments fp
            WHERE fp.student_fee_id = sf.id
        ) >= sf.net_amount
        """
    )

    # Step 4: Drop old columns
    if _column_exists("student_fees", "installment_plan"):
        op.drop_column("student_fees", "installment_plan")
    if _column_exists("student_fees", "installments_paid"):
        op.drop_column("student_fees", "installments_paid")


def downgrade() -> None:
    op.add_column(
        "student_fees",
        sa.Column("installment_plan", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "student_fees",
        sa.Column(
            "installments_paid",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.drop_column("student_fees", "months_paid")
