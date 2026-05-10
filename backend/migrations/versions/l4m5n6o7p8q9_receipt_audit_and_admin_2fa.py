"""receipt audit and admin 2fa

Revision ID: l4m5n6o7p8q9
Revises: k2l3m4n5o6p7
Create Date: 2026-05-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "l4m5n6o7p8q9"
down_revision: Union[str, None] = "k2l3m4n5o6p7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    return table in inspect(op.get_bind()).get_table_names()


def _column_exists(table: str, column: str) -> bool:
    if not _table_exists(table):
        return False
    return column in [c["name"] for c in inspect(op.get_bind()).get_columns(table)]


def upgrade() -> None:
    if _table_exists("users"):
        if not _column_exists("users", "two_factor_enabled"):
            op.add_column("users", sa.Column("two_factor_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
        if not _column_exists("users", "two_factor_channel"):
            op.add_column("users", sa.Column("two_factor_channel", sa.String(length=20), nullable=True))
        if not _column_exists("users", "two_factor_destination"):
            op.add_column("users", sa.Column("two_factor_destination", sa.String(length=255), nullable=True))

    if not _table_exists("admin_login_otp_challenges"):
        op.create_table(
            "admin_login_otp_challenges",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("challenge_id", sa.String(length=36), nullable=False, unique=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("channel", sa.String(length=20), nullable=False, server_default="whatsapp"),
            sa.Column("destination", sa.String(length=255), nullable=False),
            sa.Column("otp_hash", sa.String(length=128), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_admin_login_otp_challenges_challenge_id", "admin_login_otp_challenges", ["challenge_id"], unique=True)
        op.create_index("ix_admin_login_otp_challenges_user_id", "admin_login_otp_challenges", ["user_id"])
        op.create_index("ix_admin_login_otp_challenges_expires_at", "admin_login_otp_challenges", ["expires_at"])

    if not _table_exists("data_audit_logs"):
        op.create_table(
            "data_audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("action", sa.String(length=20), nullable=False),
            sa.Column("table_name", sa.String(length=120), nullable=False),
            sa.Column("record_id", sa.String(length=64), nullable=False),
            sa.Column("old_value", sa.JSON(), nullable=True),
            sa.Column("new_value", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_data_audit_logs_user_id", "data_audit_logs", ["user_id"])
        op.create_index("ix_data_audit_logs_action", "data_audit_logs", ["action"])
        op.create_index("ix_data_audit_logs_table_name", "data_audit_logs", ["table_name"])
        op.create_index("ix_data_audit_logs_record_id", "data_audit_logs", ["record_id"])
        op.create_index("ix_data_audit_logs_created_at", "data_audit_logs", ["created_at"])


def downgrade() -> None:
    if _table_exists("data_audit_logs"):
        op.drop_index("ix_data_audit_logs_created_at", table_name="data_audit_logs")
        op.drop_index("ix_data_audit_logs_record_id", table_name="data_audit_logs")
        op.drop_index("ix_data_audit_logs_table_name", table_name="data_audit_logs")
        op.drop_index("ix_data_audit_logs_action", table_name="data_audit_logs")
        op.drop_index("ix_data_audit_logs_user_id", table_name="data_audit_logs")
        op.drop_table("data_audit_logs")

    if _table_exists("admin_login_otp_challenges"):
        op.drop_index("ix_admin_login_otp_challenges_expires_at", table_name="admin_login_otp_challenges")
        op.drop_index("ix_admin_login_otp_challenges_user_id", table_name="admin_login_otp_challenges")
        op.drop_index("ix_admin_login_otp_challenges_challenge_id", table_name="admin_login_otp_challenges")
        op.drop_table("admin_login_otp_challenges")

    if _table_exists("users"):
        if _column_exists("users", "two_factor_destination"):
            op.drop_column("users", "two_factor_destination")
        if _column_exists("users", "two_factor_channel"):
            op.drop_column("users", "two_factor_channel")
        if _column_exists("users", "two_factor_enabled"):
            op.drop_column("users", "two_factor_enabled")

