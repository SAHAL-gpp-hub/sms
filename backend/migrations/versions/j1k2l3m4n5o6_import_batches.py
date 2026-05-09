"""add import batches tables

Revision ID: j1k2l3m4n5o6
Revises: i9j0k1l2m3n4
Create Date: 2026-05-09 17:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'j1k2l3m4n5o6'
down_revision = 'i9j0k1l2m3n4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'import_batches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(length=32), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_format', sa.String(length=16), nullable=False),
        sa.Column('merge_mode', sa.String(length=32), nullable=False, server_default='skip_duplicates'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='completed'),
        sa.Column('total_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('imported_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('skipped_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('summary', sa.JSON(), nullable=True),
        sa.Column('rollback_summary', sa.JSON(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('rolled_back_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_import_batches_entity_type'), 'import_batches', ['entity_type'], unique=False)
    op.create_index(op.f('ix_import_batches_status'), 'import_batches', ['status'], unique=False)

    op.create_table(
        'import_batch_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('import_batch_id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(length=32), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(length=32), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['import_batch_id'], ['import_batches.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_import_batch_items_import_batch_id'), 'import_batch_items', ['import_batch_id'], unique=False)
    op.create_index(op.f('ix_import_batch_items_entity_type'), 'import_batch_items', ['entity_type'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_import_batch_items_entity_type'), table_name='import_batch_items')
    op.drop_index(op.f('ix_import_batch_items_import_batch_id'), table_name='import_batch_items')
    op.drop_table('import_batch_items')
    op.drop_index(op.f('ix_import_batches_status'), table_name='import_batches')
    op.drop_index(op.f('ix_import_batches_entity_type'), table_name='import_batches')
    op.drop_table('import_batches')
