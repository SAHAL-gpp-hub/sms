"""yearend operational indexes

Revision ID: q9r0s1t2u3v4
Revises: p8q9r0s1t2u3
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "q9r0s1t2u3v4"
down_revision: Union[str, None] = "p8q9r0s1t2u3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(table: str, name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(index.get("name") == name for index in insp.get_indexes(table))


def upgrade() -> None:
    if not _index_exists("audit_logs", "ix_audit_logs_year_operation_created_at"):
        op.create_index(
            "ix_audit_logs_year_operation_created_at",
            "audit_logs",
            ["academic_year_id", "operation", "created_at"],
        )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_year_operation_created_at", table_name="audit_logs")
