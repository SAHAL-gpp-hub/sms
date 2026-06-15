"""drop_instalment_plan_column

Revision ID: ea500a5c6f73
Revises: 77814927b482
Create Date: 2026-06-15 20:26:49.083409
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'ea500a5c6f73'
down_revision: Union[str, None] = '77814927b482'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('student_fees', 'instalment_plan')


def downgrade() -> None:
    op.add_column('student_fees',
        sa.Column('instalment_plan', sa.String(length=10), nullable=False, server_default='full')
    )
