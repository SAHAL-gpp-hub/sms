"""perf audit indexes — add genuinely missing composite indexes.

Revision ID: p1q2r3s4t5u6
Revises: a7f3c2d8e9b1
Create Date: 2026-06-19

Performance audit verification showed most proposed indexes already exist
(from migrations n6o7p8q9r0s1, q9r0s1t2u3v4, etc.). Only these three are
actually missing:

  1. enrollments(student_id, academic_year_id)
     — used by ensure_enrollments_for_legacy_students, backfill_enrollments,
       fee ledger queries. Was not created by the enrollment operational-links
       migration (which only added class_id+academic_year_id+status).
  2. marks(exam_id, enrollment_id)
     — used by bulk cross-class grading (get_grade_distribution,
       get_top_students). The existing ix_marks_exam_id_subject_id covers
       (exam_id, subject_id) but not (exam_id, enrollment_id).
  3. attendance(date, status)
     — used by analytics_service.attendance_trends for daily attendance %.
     The existing ix_attendance_class_id_date covers (class_id, date) but
     not date-only scans.

All indexes use IF NOT EXISTS guards so they are safe to re-run.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "p1q2r3s4t5u6"
down_revision: Union[str, None] = "a7f3c2d8e9b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(table: str, name: str) -> bool:
    """Check if an index already exists (safe across dialects)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes WHERE tablename = :t AND indexname = :n"
        ),
        {"t": table, "n": name},
    ).first()
    return result is not None


def upgrade() -> None:
    indexes_to_add = [
        ("enrollments", "ix_enrollments_student_year", ["student_id", "academic_year_id"]),
        ("marks", "ix_marks_exam_enrollment", ["exam_id", "enrollment_id"]),
        ("attendance", "ix_attendance_date_status", ["date", "status"]),
    ]

    for table, name, columns in indexes_to_add:
        if not _index_exists(table, name):
            op.create_index(name, table, columns)
            print(f"  Created index {name} on {table}({', '.join(columns)})")
        else:
            print(f"  Index {name} already exists — skipping")


def downgrade() -> None:
    indexes_to_drop = [
        ("enrollments", "ix_enrollments_student_year"),
        ("marks", "ix_marks_exam_enrollment"),
        ("attendance", "ix_attendance_date_status"),
    ]

    for table, name in indexes_to_drop:
        if _index_exists(table, name):
            op.drop_index(name, table_name=table)
            print(f"  Dropped index {name}")
        else:
            print(f"  Index {name} does not exist — skipping")
