"""fix review report issues

Revision ID: e2f3g4h5i6j7
Revises: d1e2f3g4h5i6
Create Date: 2026-05-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision: str = "e2f3g4h5i6j7"
down_revision: Union[str, None] = "d1e2f3g4h5i6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    return table in inspect(op.get_bind()).get_table_names()


def _column_exists(table: str, column: str) -> bool:
    if not _table_exists(table):
        return False
    return column in [c["name"] for c in inspect(op.get_bind()).get_columns(table)]


def _enum_exists(enum_name: str) -> bool:
    result = op.get_bind().execute(
        text("SELECT 1 FROM pg_type WHERE typname = :name"),
        {"name": enum_name},
    ).fetchone()
    return result is not None


def upgrade() -> None:
    if _table_exists("token_blocklist") and not _column_exists("token_blocklist", "expires_at"):
        op.add_column(
            "token_blocklist",
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    if _table_exists("enrollments") and not _column_exists("enrollments", "original_roll_number"):
        op.add_column("enrollments", sa.Column("original_roll_number", sa.String(30), nullable=True))
        op.execute(text("UPDATE enrollments SET original_roll_number = roll_number WHERE original_roll_number IS NULL"))

    if not _enum_exists("auditoperationenum"):
        op.execute(text(
            "CREATE TYPE auditoperationenum AS ENUM "
            "('bulk_promote','undo_promote','new_year','activate_year','close_year',"
            "'lock_marks','issue_tc','clone_subjects','clone_fees')"
        ))
    if _table_exists("audit_logs"):
        op.execute(text(
            "ALTER TABLE audit_logs ALTER COLUMN operation "
            "TYPE auditoperationenum USING operation::auditoperationenum"
        ))

    if _table_exists("students"):
        op.execute(text("UPDATE students SET status='TC_Issued' WHERE status::text='TC Issued'"))
        op.execute(text("UPDATE students SET status='Passed_Out' WHERE status::text='Passed Out'"))

    op.execute(text("CREATE SEQUENCE IF NOT EXISTS receipt_number_seq"))
    op.execute(text("CREATE SEQUENCE IF NOT EXISTS tc_number_seq"))

    if not _table_exists("transfer_certificates"):
        op.create_table(
            "transfer_certificates",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tc_number", sa.String(30), nullable=False, unique=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("conduct", sa.String(100), nullable=True),
            sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_transfer_certificates_tc_number", "transfer_certificates", ["tc_number"], unique=True)
        op.create_index("ix_transfer_certificates_student_id", "transfer_certificates", ["student_id"])


def downgrade() -> None:
    if _table_exists("transfer_certificates"):
        op.drop_table("transfer_certificates")
    op.execute(text("DROP SEQUENCE IF EXISTS receipt_number_seq"))
    op.execute(text("DROP SEQUENCE IF EXISTS tc_number_seq"))
    if _table_exists("enrollments") and _column_exists("enrollments", "original_roll_number"):
        op.drop_column("enrollments", "original_roll_number")
    if _table_exists("token_blocklist") and _column_exists("token_blocklist", "expires_at"):
        op.drop_column("token_blocklist", "expires_at")
