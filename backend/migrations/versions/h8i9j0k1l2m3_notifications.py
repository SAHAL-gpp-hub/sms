"""notifications

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    return table in inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if not _table_exists("notification_log"):
        op.create_table(
            "notification_log",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=True),
            sa.Column("notification_type", sa.String(40), nullable=False),
            sa.Column("channel", sa.String(20), nullable=False),
            sa.Column("recipient_phone", sa.String(20), nullable=False),
            sa.Column("template_name", sa.String(100), nullable=True),
            sa.Column("message_preview", sa.Text(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("idempotency_key", sa.String(160), nullable=True, unique=True),
            sa.Column("outbox_id", sa.Integer(), sa.ForeignKey("notification_outbox.id"), nullable=True),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_notification_log_type", "notification_log", ["notification_type"])
        op.create_index("ix_notification_log_channel", "notification_log", ["channel"])
        op.create_index("ix_notification_log_status", "notification_log", ["status"])
        op.create_index("ix_notification_log_idempotency_key", "notification_log", ["idempotency_key"], unique=True)


def downgrade() -> None:
    if _table_exists("notification_log"):
        op.drop_index("ix_notification_log_idempotency_key", table_name="notification_log")
        op.drop_index("ix_notification_log_status", table_name="notification_log")
        op.drop_index("ix_notification_log_channel", table_name="notification_log")
        op.drop_index("ix_notification_log_type", table_name="notification_log")
        op.drop_table("notification_log")
