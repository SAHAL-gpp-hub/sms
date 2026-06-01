"""online payment platform charges

Revision ID: p8q9r0s1t2u3
Revises: o7p8q9r0s1t2
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "p8q9r0s1t2u3"
down_revision: Union[str, None] = "o7p8q9r0s1t2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in [col["name"] for col in insp.get_columns(table)]


def upgrade() -> None:
    bind = op.get_bind()
    if not _column_exists("online_payment_orders", "net_amount"):
        op.add_column("online_payment_orders", sa.Column("net_amount", sa.Numeric(10, 2), nullable=True))
        op.execute("UPDATE online_payment_orders SET net_amount = amount WHERE net_amount IS NULL")
        if bind.dialect.name == "sqlite":
            with op.batch_alter_table("online_payment_orders") as batch_op:
                batch_op.alter_column("net_amount", existing_type=sa.Numeric(10, 2), nullable=False)
        else:
            op.alter_column("online_payment_orders", "net_amount", existing_type=sa.Numeric(10, 2), nullable=False)

    if not _column_exists("online_payment_orders", "platform_charge"):
        op.add_column(
            "online_payment_orders",
            sa.Column("platform_charge", sa.Numeric(10, 2), nullable=True, server_default="0"),
        )
        op.execute("UPDATE online_payment_orders SET platform_charge = 0 WHERE platform_charge IS NULL")
        if bind.dialect.name == "sqlite":
            with op.batch_alter_table("online_payment_orders") as batch_op:
                batch_op.alter_column(
                    "platform_charge",
                    existing_type=sa.Numeric(10, 2),
                    nullable=False,
                    server_default=None,
                )
        else:
            op.alter_column(
                "online_payment_orders",
                "platform_charge",
                existing_type=sa.Numeric(10, 2),
                nullable=False,
                server_default=None,
            )

    if not _column_exists("online_payment_orders", "gross_amount"):
        op.add_column("online_payment_orders", sa.Column("gross_amount", sa.Numeric(10, 2), nullable=True))
        op.execute("UPDATE online_payment_orders SET gross_amount = amount WHERE gross_amount IS NULL")
        if bind.dialect.name == "sqlite":
            with op.batch_alter_table("online_payment_orders") as batch_op:
                batch_op.alter_column("gross_amount", existing_type=sa.Numeric(10, 2), nullable=False)
        else:
            op.alter_column("online_payment_orders", "gross_amount", existing_type=sa.Numeric(10, 2), nullable=False)


def downgrade() -> None:
    for column in ("gross_amount", "platform_charge", "net_amount"):
        if _column_exists("online_payment_orders", column):
            op.drop_column("online_payment_orders", column)
