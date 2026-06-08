"""notification log custom message fields

Revision ID: r0s1t2u3v4w5
Revises: q9r0s1t2u3v4
Create Date: 2026-06-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "r0s1t2u3v4w5"
down_revision: Union[str, None] = "q9r0s1t2u3v4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    return table in sa.inspect(op.get_bind()).get_table_names()


def _column_exists(table: str, column: str) -> bool:
    return any(col["name"] == column for col in sa.inspect(op.get_bind()).get_columns(table))


def _index_exists(table: str, name: str) -> bool:
    return any(index.get("name") == name for index in sa.inspect(op.get_bind()).get_indexes(table))


def upgrade() -> None:
    if not _table_exists("notification_log"):
        return

    columns = {
        "sender_user_id": sa.Column("sender_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        "sender_name": sa.Column("sender_name", sa.String(100), nullable=True),
        "recipients": sa.Column("recipients", sa.JSON(), nullable=True),
        "sent_count": sa.Column("sent_count", sa.Integer(), nullable=True),
        "failed_count": sa.Column("failed_count", sa.Integer(), nullable=True),
    }
    for name, column in columns.items():
        if not _column_exists("notification_log", name):
            op.add_column("notification_log", column)

    if not _index_exists("notification_log", "ix_notification_log_sender_user_id"):
        op.create_index("ix_notification_log_sender_user_id", "notification_log", ["sender_user_id"])


def downgrade() -> None:
    if not _table_exists("notification_log"):
        return

    if _index_exists("notification_log", "ix_notification_log_sender_user_id"):
        op.drop_index("ix_notification_log_sender_user_id", table_name="notification_log")

    for name in ("failed_count", "sent_count", "recipients", "sender_name", "sender_user_id"):
        if _column_exists("notification_log", name):
            op.drop_column("notification_log", name)
