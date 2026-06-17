"""add installment_plan and installments_paid to student_fees

Revision ID: a7f3c2d8e9b1
Revises: <previous_revision_id>
Create Date: 2026-06-16

This migration adds two columns to student_fees to support one-time
installment plan selection:

  installment_plan  VARCHAR(10)  nullable  — null until first payment
                                            values: 'full', 'half', 'quarter'
  installments_paid INTEGER      not null  default 0 — count of installments made

After the first payment is recorded the plan is locked and cannot be changed.
Subsequent payments must match the scheduled installment amounts derived from
the ORIGINAL net_amount, not from the remaining balance.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'a7f3c2d8e9b1'
down_revision = 'drop_rcpt_unique'  
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'student_fees',
        sa.Column('installment_plan', sa.String(10), nullable=True),
    )
    op.add_column(
        'student_fees',
        sa.Column('installments_paid', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade():
    op.drop_column('student_fees', 'installments_paid')
    op.drop_column('student_fees', 'installment_plan')
