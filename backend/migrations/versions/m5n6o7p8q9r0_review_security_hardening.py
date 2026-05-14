"""review security hardening

Revision ID: m5n6o7p8q9r0
Revises: l4m5n6o7p8q9
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision: str = "m5n6o7p8q9r0"
down_revision: Union[str, None] = "l4m5n6o7p8q9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _constraint_exists(table: str, constraint_name: str) -> bool:
    inspector = inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return False
    constraints = inspector.get_unique_constraints(table)
    return any(c["name"] == constraint_name for c in constraints)


def _column_exists(table: str, column: str) -> bool:
    inspector = inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return False
    return column in [c["name"] for c in inspector.get_columns(table)]


def _table_exists(table: str) -> bool:
    return table in inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if _column_exists("students", "contact"):
        op.alter_column(
            "students",
            "contact",
            existing_type=sa.String(length=10),
            type_=sa.String(length=20),
            existing_nullable=False,
        )

    if not _constraint_exists("fee_structures", "uq_fee_structure_class_head_year"):
        op.execute(text(
            """
            WITH duplicates AS (
                SELECT id,
                       MIN(id) OVER (
                           PARTITION BY class_id, fee_head_id, academic_year_id
                       ) AS keep_id
                FROM fee_structures
            )
            UPDATE student_fees sf
            SET fee_structure_id = duplicates.keep_id
            FROM duplicates
            WHERE sf.fee_structure_id = duplicates.id
              AND duplicates.id <> duplicates.keep_id
            """
        ))
        op.execute(text(
            """
            DELETE FROM fee_structures fs
            USING fee_structures kept
            WHERE fs.id > kept.id
              AND fs.class_id IS NOT DISTINCT FROM kept.class_id
              AND fs.fee_head_id IS NOT DISTINCT FROM kept.fee_head_id
              AND fs.academic_year_id IS NOT DISTINCT FROM kept.academic_year_id
            """
        ))
        op.create_unique_constraint(
            "uq_fee_structure_class_head_year",
            "fee_structures",
            ["class_id", "fee_head_id", "academic_year_id"],
        )

    if not _table_exists("operation_jobs"):
        op.create_table(
            "operation_jobs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("job_type", sa.String(length=80), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("result", sa.JSON(), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_operation_jobs_job_type", "operation_jobs", ["job_type"])
        op.create_index("ix_operation_jobs_status", "operation_jobs", ["status"])
        op.create_index("ix_operation_jobs_actor_user_id", "operation_jobs", ["actor_user_id"])

    if not _table_exists("profile_correction_requests"):
        op.create_table(
            "profile_correction_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False),
            sa.Column("requested_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("field_name", sa.String(length=80), nullable=False),
            sa.Column("current_value", sa.Text(), nullable=True),
            sa.Column("requested_value", sa.Text(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("admin_note", sa.Text(), nullable=True),
            sa.Column("resolved_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_profile_correction_requests_student_id", "profile_correction_requests", ["student_id"])
        op.create_index("ix_profile_correction_requests_requested_by_user_id", "profile_correction_requests", ["requested_by_user_id"])
        op.create_index("ix_profile_correction_requests_status", "profile_correction_requests", ["status"])

    if not _table_exists("auth_refresh_sessions"):
        op.create_table(
            "auth_refresh_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token_hash", sa.String(length=128), nullable=False, unique=True),
            sa.Column("family_id", sa.String(length=36), nullable=False),
            sa.Column("replaced_by_session_id", sa.Integer(), sa.ForeignKey("auth_refresh_sessions.id"), nullable=True),
            sa.Column("user_agent", sa.String(length=255), nullable=True),
            sa.Column("ip_address", sa.String(length=64), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_auth_refresh_sessions_user_id", "auth_refresh_sessions", ["user_id"])
        op.create_index("ix_auth_refresh_sessions_token_hash", "auth_refresh_sessions", ["token_hash"])
        op.create_index("ix_auth_refresh_sessions_family_id", "auth_refresh_sessions", ["family_id"])
        op.create_index("ix_auth_refresh_sessions_expires_at", "auth_refresh_sessions", ["expires_at"])

    if not _table_exists("portal_activation_invites"):
        op.create_table(
            "portal_activation_invites",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("invite_id", sa.String(length=36), nullable=False, unique=True),
            sa.Column("token_hash", sa.String(length=128), nullable=False, unique=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
            sa.Column("account_type", sa.String(length=20), nullable=False),
            sa.Column("destination", sa.String(length=255), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_portal_activation_invites_invite_id", "portal_activation_invites", ["invite_id"])
        op.create_index("ix_portal_activation_invites_token_hash", "portal_activation_invites", ["token_hash"])
        op.create_index("ix_portal_activation_invites_student_id", "portal_activation_invites", ["student_id"])
        op.create_index("ix_portal_activation_invites_status", "portal_activation_invites", ["status"])
        op.create_index("ix_portal_activation_invites_created_by_user_id", "portal_activation_invites", ["created_by_user_id"])
        op.create_index("ix_portal_activation_invites_expires_at", "portal_activation_invites", ["expires_at"])


def downgrade() -> None:
    if _table_exists("portal_activation_invites"):
        op.drop_table("portal_activation_invites")
    if _table_exists("auth_refresh_sessions"):
        op.drop_table("auth_refresh_sessions")
    if _table_exists("profile_correction_requests"):
        op.drop_table("profile_correction_requests")
    if _table_exists("operation_jobs"):
        op.drop_table("operation_jobs")
    if _constraint_exists("fee_structures", "uq_fee_structure_class_head_year"):
        op.drop_constraint("uq_fee_structure_class_head_year", "fee_structures", type_="unique")
    if _column_exists("students", "contact"):
        op.alter_column(
            "students",
            "contact",
            existing_type=sa.String(length=20),
            type_=sa.String(length=10),
            existing_nullable=False,
        )
