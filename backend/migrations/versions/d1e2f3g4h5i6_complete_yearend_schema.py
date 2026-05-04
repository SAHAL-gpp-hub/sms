"""complete_yearend_schema

Adds every table and column required by the SMS planning document that was
previously missing. Idempotent — safe to run on any existing database state.

Changes:
  1.  academic_years.status          (draft / active / closed)
  2.  academic_years.is_upcoming     (boolean — "next year" before activation)
  3.  classes.capacity               (max students per section)
  4.  classes.medium                 (English / Gujarati / Both)
  5.  classes.promotion_status       (not_started / in_progress / completed)
  6.  subjects.code                  (short code e.g. MATH)
  7.  subjects.is_exam_eligible      (boolean)
  8.  subjects.passing_marks         (integer)
  9.  exams.weightage                (decimal — % contribution to final result)
  10. students.reason_for_leaving    (text — mandatory for dropout)
  11. students.previous_school       (text)
  12. marks.locked_at                (timestamp — set when year closes)
  13. student_fees.invoice_type      (regular / arrear)
  14. student_fees.source_invoice_id (FK to original fee for arrears)
  15. enrollments                    (NEW central year-scoped node)
  16. academic_calendar              (NEW term / holiday / event calendar)
  17. report_cards                   (NEW stored PDF path + lock flag)
  18. audit_logs                     (NEW every bulk operation logged)
  19. Index: students.gr_number
  20. Index: students.status
  21. Index: enrollments composite

Revision ID: d1e2f3g4h5i6
Revises: c1d2e3f4
Create Date: 2026-05-04
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision: str = "d1e2f3g4h5i6"
down_revision: Union[str, None] = "c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── helpers ───────────────────────────────────────────────────────────────────

def _table_exists(table: str) -> bool:
    return table in inspect(op.get_bind()).get_table_names()


def _column_exists(table: str, column: str) -> bool:
    if not _table_exists(table):
        return False
    return column in [c["name"] for c in inspect(op.get_bind()).get_columns(table)]


def _index_exists(index: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        text("SELECT 1 FROM pg_indexes WHERE indexname = :n"), {"n": index}
    ).fetchone()
    return result is not None


def _enum_exists(enum_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        text("SELECT 1 FROM pg_type WHERE typname = :n"), {"n": enum_name}
    ).fetchone()
    return result is not None


# ── upgrade ───────────────────────────────────────────────────────────────────

def upgrade() -> None:

    # ── 1. academic_years.status ─────────────────────────────────────────────
    if not _enum_exists("yearsstatusenum"):
        op.execute(text("CREATE TYPE yearsstatusenum AS ENUM ('draft', 'active', 'closed')"))

    if _table_exists("academic_years"):
        if not _column_exists("academic_years", "status"):
            op.add_column(
                "academic_years",
                sa.Column(
                    "status",
                    sa.Enum("draft", "active", "closed", name="yearsstatusenum"),
                    nullable=False,
                    server_default="active",
                ),
            )
            # Back-fill: current year → active, others → closed
            op.execute(text(
                    """
                        UPDATE academic_years
                        SET status = CASE
                            WHEN is_current THEN 'active'::yearsstatusenum
                            ELSE 'closed'::yearsstatusenum
                        END
                    """
))

        if not _column_exists("academic_years", "is_upcoming"):
            op.add_column(
                "academic_years",
                sa.Column("is_upcoming", sa.Boolean(), nullable=False, server_default="false"),
            )

    # ── 2. classes additions ──────────────────────────────────────────────────
    if _table_exists("classes"):
        for col, defn in [
            ("capacity",         sa.Column("capacity", sa.Integer(), nullable=True)),
            ("medium",           sa.Column("medium", sa.String(20), nullable=True, server_default="English")),
            ("promotion_status", sa.Column("promotion_status", sa.String(20), nullable=False, server_default="not_started")),
        ]:
            if not _column_exists("classes", col):
                op.add_column("classes", defn)

    # ── 3. subjects additions ─────────────────────────────────────────────────
    if _table_exists("subjects"):
        for col, defn in [
            ("code",             sa.Column("code", sa.String(20), nullable=True)),
            ("is_exam_eligible", sa.Column("is_exam_eligible", sa.Boolean(), nullable=False, server_default="true")),
            ("passing_marks",    sa.Column("passing_marks", sa.Integer(), nullable=True)),
        ]:
            if not _column_exists("subjects", col):
                op.add_column("subjects", defn)

    # ── 4. exams additions ────────────────────────────────────────────────────
    if _table_exists("exams"):
        if not _column_exists("exams", "weightage"):
            op.add_column(
                "exams",
                sa.Column("weightage", sa.Numeric(5, 2), nullable=True),
            )

    # ── 5. students additions ─────────────────────────────────────────────────
    if _table_exists("students"):
        for col, defn in [
            ("reason_for_leaving", sa.Column("reason_for_leaving", sa.Text(), nullable=True)),
            ("previous_school",    sa.Column("previous_school", sa.Text(), nullable=True)),
        ]:
            if not _column_exists("students", col):
                op.add_column("students", defn)

        # Extend StudentStatusEnum with new values
        # PostgreSQL requires ALTER TYPE ... ADD VALUE outside transactions for enums
        conn = op.get_bind()
        existing_vals = {
            row[0] for row in conn.execute(
                text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'studentstatusenum'")
            )
        }
        for val in ("Alumni", "On_Hold", "Detained", "Provisional"):
            if val not in existing_vals:
                conn.execute(text(f"ALTER TYPE studentstatusenum ADD VALUE IF NOT EXISTS '{val}'"))

    # ── 6. marks.locked_at ───────────────────────────────────────────────────
    if _table_exists("marks"):
        if not _column_exists("marks", "locked_at"):
            op.add_column(
                "marks",
                sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
            )

    # ── 7. student_fees additions ─────────────────────────────────────────────
    if _table_exists("student_fees"):
        if not _column_exists("student_fees", "invoice_type"):
            op.add_column(
                "student_fees",
                sa.Column(
                    "invoice_type",
                    sa.String(10),
                    nullable=False,
                    server_default="regular",
                ),
            )
        if not _column_exists("student_fees", "source_invoice_id"):
            op.add_column(
                "student_fees",
                sa.Column("source_invoice_id", sa.Integer(), nullable=True),
            )
            op.create_foreign_key(
                "fk_student_fees_source_invoice_id",
                "student_fees",
                "student_fees",
                ["source_invoice_id"],
                ["id"],
                ondelete="SET NULL",
            )

    # ── 8. enrollments table ──────────────────────────────────────────────────
    # This is the most critical missing piece. It is the year-scoped node that
    # attendance, marks, and fees should all eventually FK to.
    # We add it as a NEW table alongside the existing schema so existing data
    # is not disrupted. A separate migration (or service layer) populates it
    # by back-filling from existing student rows.
    if not _table_exists("enrollments"):
        op.create_table(
            "enrollments",
            sa.Column("id",               sa.Integer(), primary_key=True),
            sa.Column("student_id",       sa.Integer(), sa.ForeignKey("students.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("academic_year_id", sa.Integer(), sa.ForeignKey("academic_years.id"), nullable=False),
            sa.Column("class_id",         sa.Integer(), sa.ForeignKey("classes.id"), nullable=False),
            sa.Column("roll_number",      sa.String(30), nullable=True),   # string for composite formats
            sa.Column("status",           sa.String(20), nullable=False, server_default="active"),
                                          # active / retained / graduated / transferred / dropped / provisional / on_hold
            sa.Column("promotion_action", sa.String(20), nullable=True),
                                          # promoted / retained / graduated / transferred / dropped / on_hold
            sa.Column("promotion_status", sa.String(20), nullable=False, server_default="not_started"),
                                          # not_started / completed — per-student idempotency
            sa.Column("enrolled_on",      sa.Date(), nullable=False, server_default=sa.func.current_date()),
            sa.Column("reason_for_leaving", sa.Text(), nullable=True),
            sa.Column("created_at",       sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("student_id", "academic_year_id", name="uq_enrollment_student_year"),
        )
        op.create_index(
            "ix_enrollments_year_class",
            "enrollments",
            ["academic_year_id", "class_id"],
        )
        op.create_index(
            "ix_enrollments_student",
            "enrollments",
            ["student_id"],
        )
        op.create_index(
            "ix_enrollments_status",
            "enrollments",
            ["status"],
        )

    # ── 9. academic_calendar table ────────────────────────────────────────────
    if not _table_exists("academic_calendar"):
        op.create_table(
            "academic_calendar",
            sa.Column("id",               sa.Integer(), primary_key=True),
            sa.Column("academic_year_id", sa.Integer(), sa.ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False),
            sa.Column("event_type",       sa.String(20), nullable=False),
                                          # holiday / exam_period / term_start / term_end / event
            sa.Column("title",            sa.String(200), nullable=False),
            sa.Column("start_date",       sa.Date(), nullable=False),
            sa.Column("end_date",         sa.Date(), nullable=False),
            sa.Column("description",      sa.Text(), nullable=True),
            sa.Column("affects_attendance", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("created_at",       sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index(
            "ix_calendar_year_dates",
            "academic_calendar",
            ["academic_year_id", "start_date", "end_date"],
        )

    # ── 10. report_cards table ────────────────────────────────────────────────
    if not _table_exists("report_cards"):
        op.create_table(
            "report_cards",
            sa.Column("id",           sa.Integer(), primary_key=True),
            sa.Column("enrollment_id", sa.Integer(), sa.ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False),
            sa.Column("exam_id",       sa.Integer(), sa.ForeignKey("exams.id"), nullable=True),
            sa.Column("pdf_path",      sa.String(500), nullable=True),
            sa.Column("is_locked",     sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("generated_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("locked_at",     sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("enrollment_id", "exam_id", name="uq_report_card_enrollment_exam"),
        )

    # ── 11. audit_logs table ──────────────────────────────────────────────────
    if not _table_exists("audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id",           sa.Integer(), primary_key=True),
            sa.Column("operation",    sa.String(50), nullable=False),
                                      # bulk_promote / new_year / issue_tc / lock_marks / undo_promote
            sa.Column("performed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("academic_year_id", sa.Integer(), nullable=True),
            sa.Column("class_id",     sa.Integer(), nullable=True),
            sa.Column("affected_count", sa.Integer(), nullable=True),
            sa.Column("payload",      sa.Text(), nullable=True),   # JSON snapshot
            sa.Column("result",       sa.String(20), nullable=False, server_default="success"),
                                      # success / partial / failed / rolled_back
            sa.Column("error_detail", sa.Text(), nullable=True),
            sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_audit_logs_operation",    "audit_logs", ["operation"])
        op.create_index("ix_audit_logs_year",         "audit_logs", ["academic_year_id"])
        op.create_index("ix_audit_logs_performed_by", "audit_logs", ["performed_by"])

    # ── 12. Indexes on frequently-queried columns ──────────────────────────────
    if _table_exists("students"):
        if not _index_exists("ix_students_gr_number"):
            op.create_index("ix_students_gr_number", "students", ["gr_number"])
        if not _index_exists("ix_students_status"):
            op.create_index("ix_students_status", "students", ["status"])
        if not _index_exists("ix_students_class_id"):
            op.create_index("ix_students_class_id", "students", ["class_id"])

    if _table_exists("marks"):
        if not _index_exists("ix_marks_student_exam"):
            op.create_index("ix_marks_student_exam", "marks", ["student_id", "exam_id"])

    if _table_exists("student_fees"):
        if not _index_exists("ix_student_fees_student_year"):
            op.create_index("ix_student_fees_student_year", "student_fees", ["student_id", "academic_year_id"])

    # ── 13. Back-fill enrollments from existing student rows ──────────────────
    # Creates one enrollment per student per their current academic_year_id.
    # This is safe to run multiple times due to ON CONFLICT DO NOTHING.
    # Cast legacy status values (which may not be in the new enum) to text first,
    # then map to new enrollment status values.
    if _table_exists("enrollments") and _table_exists("students"):
        op.execute(text("""
            INSERT INTO enrollments (student_id, academic_year_id, class_id, roll_number, status, enrolled_on)
            SELECT
                s.id,
                s.academic_year_id,
                s.class_id,
                s.roll_number::text,
                CASE s.status::text
                    WHEN 'Active'     THEN 'active'
                    WHEN 'TC Issued'  THEN 'transferred'
                    WHEN 'Left'       THEN 'dropped'
                    WHEN 'Passed Out' THEN 'graduated'
                    ELSE 'active'
                END,
                s.admission_date
            FROM students s
            WHERE s.class_id IS NOT NULL
            ON CONFLICT (student_id, academic_year_id) DO NOTHING
        """))


# ── downgrade ─────────────────────────────────────────────────────────────────

def downgrade() -> None:
    # Drop new tables
    for tbl in ("audit_logs", "report_cards", "academic_calendar", "enrollments"):
        if _table_exists(tbl):
            op.drop_table(tbl)

    # Drop added columns (reverse order)
    col_drops = [
        ("student_fees", "source_invoice_id"),
        ("student_fees", "invoice_type"),
        ("marks", "locked_at"),
        ("students", "previous_school"),
        ("students", "reason_for_leaving"),
        ("exams", "weightage"),
        ("subjects", "passing_marks"),
        ("subjects", "is_exam_eligible"),
        ("subjects", "code"),
        ("classes", "promotion_status"),
        ("classes", "medium"),
        ("classes", "capacity"),
        ("academic_years", "is_upcoming"),
        ("academic_years", "status"),
    ]
    for tbl, col in col_drops:
        if _column_exists(tbl, col):
            op.drop_column(tbl, col)

    # Drop enum
    if _enum_exists("yearsstatusenum"):
        op.execute(text("DROP TYPE yearsstatusenum"))