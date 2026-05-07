"""online payments

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, None] = "f6g7h8i9j0k1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    return table in inspect(op.get_bind()).get_table_names()


def _column_exists(table: str, column: str) -> bool:
    if not _table_exists(table):
        return False
    return column in [c["name"] for c in inspect(op.get_bind()).get_columns(table)]


def upgrade() -> None:
    if not _table_exists("online_payment_orders"):
        op.create_table(
            "online_payment_orders",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("student_fee_id", sa.Integer(), sa.ForeignKey("student_fees.id"), nullable=False),
            sa.Column("razorpay_order_id", sa.Text(), nullable=False, unique=True),
            sa.Column("razorpay_payment_id", sa.Text(), nullable=True),
            sa.Column("razorpay_signature", sa.Text(), nullable=True),
            sa.Column("amount", sa.Numeric(10, 2), nullable=False),
            sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
            sa.Column("status", sa.String(20), nullable=False, server_default="created"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("failure_reason", sa.Text(), nullable=True),
            sa.CheckConstraint(
                "status IN ('created', 'paid', 'failed', 'expired')",
                name="online_payment_status_check",
            ),
        )
        op.create_index(
            "ix_online_payment_orders_student_fee_id",
            "online_payment_orders",
            ["student_fee_id"],
        )
        op.create_index(
            "ix_online_payment_orders_status",
            "online_payment_orders",
            ["status"],
        )

    if _table_exists("fee_payments"):
        if not _column_exists("fee_payments", "online_order_id"):
            op.add_column("fee_payments", sa.Column("online_order_id", sa.Integer(), nullable=True))
            op.create_foreign_key(
                "fk_fee_payments_online_order_id",
                "fee_payments",
                "online_payment_orders",
                ["online_order_id"],
                ["id"],
            )
            op.create_index(
                "ix_fee_payments_online_order_id",
                "fee_payments",
                ["online_order_id"],
                unique=True,
            )
        if not _column_exists("fee_payments", "notes"):
            op.add_column("fee_payments", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    if _table_exists("fee_payments"):
        if _column_exists("fee_payments", "notes"):
            op.drop_column("fee_payments", "notes")
        if _column_exists("fee_payments", "online_order_id"):
            op.drop_index("ix_fee_payments_online_order_id", table_name="fee_payments")
            op.drop_constraint("fk_fee_payments_online_order_id", "fee_payments", type_="foreignkey")
            op.drop_column("fee_payments", "online_order_id")
    if _table_exists("online_payment_orders"):
        op.drop_index("ix_online_payment_orders_status", table_name="online_payment_orders")
        op.drop_index("ix_online_payment_orders_student_fee_id", table_name="online_payment_orders")
        op.drop_table("online_payment_orders")
