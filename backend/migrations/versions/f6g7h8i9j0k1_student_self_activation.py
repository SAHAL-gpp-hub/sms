"""student self activation

Revision ID: f6g7h8i9j0k1
Revises: e2f3g4h5i6j7
Create Date: 2026-05-06
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision: str = "f6g7h8i9j0k1"
down_revision: Union[str, None] = "e2f3g4h5i6j7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    return table in inspect(op.get_bind()).get_table_names()


def _column_exists(table: str, column: str) -> bool:
    if not _table_exists(table):
        return False
    return column in [c["name"] for c in inspect(op.get_bind()).get_columns(table)]


def _index_exists(table: str, index_name: str) -> bool:
    if not _table_exists(table):
        return False
    return any(i["name"] == index_name for i in inspect(op.get_bind()).get_indexes(table))


def _unique_exists(table: str, name: str) -> bool:
    if not _table_exists(table):
        return False
    return any(c["name"] == name for c in inspect(op.get_bind()).get_unique_constraints(table))


def _add_pg_enum_value(enum_name: str, value: str) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    exists = bind.execute(
        text(
            "SELECT 1 FROM pg_enum e "
            "JOIN pg_type t ON t.oid = e.enumtypid "
            "WHERE t.typname = :enum_name AND e.enumlabel = :value"
        ),
        {"enum_name": enum_name, "value": value},
    ).fetchone()
    if not exists:
        op.execute(text(f"ALTER TYPE {enum_name} ADD VALUE '{value}'"))


def upgrade() -> None:
    for value in (
        "student_activation_started",
        "student_activation_verified",
        "student_activation_completed",
        "student_activation_failed",
    ):
        _add_pg_enum_value("auditoperationenum", value)

    if _table_exists("students"):
        for column_name, column in (
            ("student_email", sa.Column("student_email", sa.String(100), nullable=True)),
            ("student_phone", sa.Column("student_phone", sa.String(20), nullable=True)),
            ("guardian_email", sa.Column("guardian_email", sa.String(100), nullable=True)),
            ("guardian_phone", sa.Column("guardian_phone", sa.String(20), nullable=True)),
        ):
            if not _column_exists("students", column_name):
                op.add_column("students", column)

        if not _unique_exists("students", "uq_students_student_user_id"):
            op.create_unique_constraint("uq_students_student_user_id", "students", ["student_user_id"])
        if not _index_exists("students", "ix_students_student_email"):
            op.create_index("ix_students_student_email", "students", ["student_email"], unique=True)
        if not _index_exists("students", "ix_students_guardian_email"):
            op.create_index("ix_students_guardian_email", "students", ["guardian_email"])

    if not _table_exists("student_activation_requests"):
        op.create_table(
            "student_activation_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("activation_id", sa.String(36), nullable=False),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
            sa.Column("account_type", sa.String(20), nullable=False),
            sa.Column("destination", sa.String(255), nullable=False),
            sa.Column("destination_fingerprint", sa.String(64), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("resend_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("request_ip", sa.String(64), nullable=True),
            sa.Column("user_agent", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_student_activation_requests_activation_id", "student_activation_requests", ["activation_id"], unique=True)
        op.create_index("ix_student_activation_requests_student_id", "student_activation_requests", ["student_id"])
        op.create_index("ix_student_activation_requests_fingerprint", "student_activation_requests", ["destination_fingerprint"])
        op.create_index("ix_student_activation_requests_expires_at", "student_activation_requests", ["expires_at"])

    if not _table_exists("otp_verifications"):
        op.create_table(
            "otp_verifications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("activation_request_id", sa.Integer(), sa.ForeignKey("student_activation_requests.id", ondelete="CASCADE"), nullable=False),
            sa.Column("provider", sa.String(20), nullable=False, server_default="email"),
            sa.Column("destination_fingerprint", sa.String(64), nullable=False),
            sa.Column("otp_hash", sa.String(128), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("resend_available_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_otp_verifications_activation_request_id", "otp_verifications", ["activation_request_id"])
        op.create_index("ix_otp_verifications_fingerprint", "otp_verifications", ["destination_fingerprint"])
        op.create_index("ix_otp_verifications_expires_at", "otp_verifications", ["expires_at"])

    if not _table_exists("notification_outbox"):
        op.create_table(
            "notification_outbox",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("provider", sa.String(20), nullable=False),
            sa.Column("destination", sa.String(255), nullable=False),
            sa.Column("subject", sa.String(255), nullable=True),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
            sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_notification_outbox_status", "notification_outbox", ["status"])
        op.create_index("ix_notification_outbox_next_attempt_at", "notification_outbox", ["next_attempt_at"])


def downgrade() -> None:
    if _table_exists("notification_outbox"):
        op.drop_table("notification_outbox")
    if _table_exists("otp_verifications"):
        op.drop_table("otp_verifications")
    if _table_exists("student_activation_requests"):
        op.drop_table("student_activation_requests")

    if _table_exists("students"):
        if _index_exists("students", "ix_students_guardian_email"):
            op.drop_index("ix_students_guardian_email", table_name="students")
        if _index_exists("students", "ix_students_student_email"):
            op.drop_index("ix_students_student_email", table_name="students")
        if _unique_exists("students", "uq_students_student_user_id"):
            op.drop_constraint("uq_students_student_user_id", "students", type_="unique")
        for column_name in ("guardian_phone", "guardian_email", "student_phone", "student_email"):
            if _column_exists("students", column_name):
                op.drop_column("students", column_name)
