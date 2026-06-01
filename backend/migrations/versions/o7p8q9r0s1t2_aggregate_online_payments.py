"""aggregate online payments

Revision ID: o7p8q9r0s1t2
Revises: n6o7p8q9r0s1
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "o7p8q9r0s1t2"
down_revision: Union[str, None] = "n6o7p8q9r0s1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in [col["name"] for col in insp.get_columns(table)]


def _index_exists(table: str, name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(index.get("name") == name for index in insp.get_indexes(table))


def upgrade() -> None:
    if not _column_exists("online_payment_orders", "student_id"):
        op.add_column("online_payment_orders", sa.Column("student_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_online_payment_orders_student_id",
            "online_payment_orders",
            "students",
            ["student_id"],
            ["id"],
        )
    if not _column_exists("online_payment_orders", "scope"):
        op.add_column(
            "online_payment_orders",
            sa.Column("scope", sa.String(length=30), nullable=False, server_default="single_fee"),
        )
        op.alter_column("online_payment_orders", "scope", server_default=None)
    if not _column_exists("online_payment_orders", "payment_option"):
        op.add_column("online_payment_orders", sa.Column("payment_option", sa.String(length=20), nullable=True))
    if not _index_exists("online_payment_orders", "ix_online_payment_orders_student_id"):
        op.create_index("ix_online_payment_orders_student_id", "online_payment_orders", ["student_id"])

    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("online_payment_orders") as batch_op:
            batch_op.alter_column("student_fee_id", existing_type=sa.Integer(), nullable=True)
    else:
        op.alter_column("online_payment_orders", "student_fee_id", existing_type=sa.Integer(), nullable=True)

    op.execute(
        """
        UPDATE online_payment_orders
        SET student_id = (
            SELECT sf.student_id
            FROM student_fees sf
            WHERE sf.id = online_payment_orders.student_fee_id
        )
        WHERE student_id IS NULL
          AND student_fee_id IS NOT NULL
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("online_payment_orders") as batch_op:
            batch_op.alter_column("student_fee_id", existing_type=sa.Integer(), nullable=False)
    else:
        op.alter_column("online_payment_orders", "student_fee_id", existing_type=sa.Integer(), nullable=False)

    if _index_exists("online_payment_orders", "ix_online_payment_orders_student_id"):
        op.drop_index("ix_online_payment_orders_student_id", table_name="online_payment_orders")
    for column in ("payment_option", "scope", "student_id"):
        if _column_exists("online_payment_orders", column):
            op.drop_column("online_payment_orders", column)
