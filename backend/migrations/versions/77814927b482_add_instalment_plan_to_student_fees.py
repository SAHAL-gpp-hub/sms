"""add_instalment_plan_to_student_fees

Revision ID: 77814927b482
Revises: r0s1t2u3v4w5
Create Date: 2026-06-15 13:02:06.787477
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '77814927b482'
down_revision: Union[str, None] = 'r0s1t2u3v4w5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('student_fees',
        sa.Column('instalment_plan', sa.String(length=10), nullable=False, server_default='full')
    )


def downgrade() -> None:
    op.drop_column('student_fees', 'instalment_plan')

