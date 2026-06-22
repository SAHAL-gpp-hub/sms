"""fee_payments.online_order_id non-unique index

The original online-payments migration (g7h8i9j0k1l2) created
ix_fee_payments_online_order_id with unique=True, back when a payment
order only ever applied to a single StudentFee row (scope="single_fee").

The aggregate-payments migration (o7p8q9r0s1t2) later introduced the
"current_year" scope, where ONE online order is allocated across MANY
StudentFee rows (tuition + exam + activity, …). allocate_payment() in
fee_service therefore inserts MULTIPLE fee_payments sharing the same
online_order_id — which the unique index rejects:

    duplicate key value violates unique constraint
    "ix_fee_payments_online_order_id"
    Key (online_order_id)=(8) already exists.

This is a legitimate 1-to-many relationship (see
OnlinePaymentOrder.payments in base_models.py), so the index must be a
plain (non-unique) lookup index, not a uniqueness constraint.

Note: the ORM model has never declared unique=True on this column, so
the test suite (which builds its schema via Base.metadata.create_all)
never reproduced the production failure. Only the migration-built
production DB carried the wrong constraint.

Revision ID: c4d5e6f7a8b9
Revises: b1c2d3e4f5g6
Create Date: 2026-06-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "b1c2d3e4f5g6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = "ix_fee_payments_online_order_id"
TABLE = "fee_payments"
COLUMN = "online_order_id"


def _index_exists(inspector, name: str, table: str) -> bool:
    return any(idx.get("name") == name for idx in inspector.get_indexes(table))


def _index_is_unique(inspector, name: str, table: str) -> bool:
    for idx in inspector.get_indexes(table):
        if idx.get("name") == name:
            return bool(idx.get("unique", False))
    return False


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Only act when the column/index actually exist (guarded like the other
    # migrations in this repo, so this is safe to run on partially-migrated DBs).
    if COLUMN not in [c["name"] for c in inspector.get_columns(TABLE)]:
        return

    if _index_exists(inspector, INDEX_NAME, TABLE):
        # Drop + recreate as non-unique regardless of current state. The previous
        # index may be unique (the bug) or already non-unique (idempotent).
        op.drop_index(INDEX_NAME, table_name=TABLE)

    op.create_index(INDEX_NAME, TABLE, [COLUMN], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if COLUMN not in [c["name"] for c in inspector.get_columns(TABLE)]:
        return

    if _index_exists(inspector, INDEX_NAME, TABLE):
        op.drop_index(INDEX_NAME, table_name=TABLE)
    # Restore the historical (buggy) unique index so the downgrade is faithful
    # to the previous schema, even though it reintroduces the original defect.
    op.create_index(INDEX_NAME, TABLE, [COLUMN], unique=True)
