"""remove late/leave attendance statuses

Attendance is now strictly present ("P") or absent ("A"). This migration:

  1. Converts all legacy status values (L, OL, late, leave, Late, Leave,
     LATE, LEAVE and any other non-P/A value) to "A" (absent).
  2. Adds a CHECK constraint to enforce status ∈ {'P', 'A'} going forward.

The application code (model enum, Pydantic Literal validator) already
rejects anything other than P/A at the Python layer. This CHECK constraint
provides the same guarantee at the DB layer.

Revision ID: q1a2b3c4d5e6f
Revises: p1q2r3s4t5u6
Create Date: 2026-06-19

NOTE: downgrade() removes the CHECK constraint but does NOT restore rows
that were converted to 'A' during upgrade(). That data loss is irreversible
without a prior backup.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "q1a2b3c4d5e6f"
down_revision: Union[str, None] = "p1q2r3s4t5u6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CK_NAME = "ck_attendance_status_present_absent"


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Convert legacy statuses to "A" ──────────────────────────────────
    #    Any row whose status is NOT "P" and NOT "A" → set to "A".
    #    This covers: "L", "OL", "late", "leave", "Late", "Leave",
    #    "LATE", "LEAVE", or any other junk a bug may have inserted.
    result = conn.execute(
        sa.text(
            "UPDATE attendance SET status = 'A' "
            "WHERE status NOT IN ('P', 'A')"
        )
    )
    # Log only the rows that were actually changed, not all 'A' rows.
    print(f"[migration] rows converted to 'A': {result.rowcount}")

    # ── 2. Drop the CHECK constraint if it already exists (idempotent) ────
    conn.execute(
        sa.text(f"ALTER TABLE attendance DROP CONSTRAINT IF EXISTS {CK_NAME}")
    )

    # ── 3. Add the CHECK constraint ───────────────────────────────────────
    conn.execute(
        sa.text(
            f"ALTER TABLE attendance "
            f"ADD CONSTRAINT {CK_NAME} "
            f"CHECK (status IN ('P', 'A'))"
        )
    )
    print(f"[migration] added CHECK constraint {CK_NAME} on attendance.status")


def downgrade() -> None:
    """
    Remove the CHECK constraint so legacy statuses can be written again.

    NOTE: this does NOT restore rows that were converted to 'A' during
    upgrade(). That data loss is irreversible without a prior backup.
    """
    conn = op.get_bind()
    conn.execute(sa.text(f"ALTER TABLE attendance DROP CONSTRAINT IF EXISTS {CK_NAME}"))
    print(f"[migration] dropped CHECK constraint {CK_NAME}")