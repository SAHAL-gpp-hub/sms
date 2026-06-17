"""drop unique constraint on fee_payments.receipt_number

Multiple FeePayment rows now share the same receipt_number when a single
payment session spans several fee heads (e.g. paying ₹750 that covers
Tuition ₹500 + Exam ₹150 + Activity ₹100 in one go).  The uniqueness
constraint was correct when each payment produced exactly one receipt row,
but is now wrong.  A plain index is kept so lookups by receipt_number
remain fast.

Revision ID: drop_rcpt_unique
Revises: <your previous revision id here>
Create Date: 2026-06-16
"""
from alembic import op

# revision identifiers
revision = 'drop_rcpt_unique'
down_revision = 'ea500a5c6f73'   # ← set this to your current head revision ID
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the unique constraint (name may vary — check with \d fee_payments in psql)
    op.drop_constraint(
        'fee_payments_receipt_number_key',   # default name Postgres gives a UNIQUE column
        'fee_payments',
        type_='unique',
    )
    # Keep a non-unique index so receipt_number lookups stay fast
    op.create_index(
        'ix_fee_payments_receipt_number',
        'fee_payments',
        ['receipt_number'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_fee_payments_receipt_number', table_name='fee_payments')
    op.create_unique_constraint(
        'fee_payments_receipt_number_key',
        'fee_payments',
        ['receipt_number'],
    )
