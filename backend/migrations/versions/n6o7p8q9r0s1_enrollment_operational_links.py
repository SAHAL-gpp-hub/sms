"""enrollment operational links

Revision ID: n6o7p8q9r0s1
Revises: m5n6o7p8q9r0
Create Date: 2026-05-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "n6o7p8q9r0s1"
down_revision: Union[str, None] = "m5n6o7p8q9r0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in [col["name"] for col in insp.get_columns(table)]


def _constraint_exists(table: str, name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    constraints = insp.get_unique_constraints(table) + insp.get_foreign_keys(table)
    return any(c.get("name") == name for c in constraints)


def _index_exists(table: str, name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(index.get("name") == name for index in insp.get_indexes(table))


def upgrade() -> None:
    for table, name, columns in (
        ("attendance", "ix_attendance_class_id_date", ["class_id", "date"]),
        ("fee_payments", "ix_fee_payments_student_fee_id", ["student_fee_id"]),
        ("marks", "ix_marks_exam_id_subject_id", ["exam_id", "subject_id"]),
        ("student_fees", "ix_student_fees_enrollment_id_academic_year_id", ["enrollment_id", "academic_year_id"]),
        ("enrollments", "ix_enrollments_class_id_academic_year_id_status", ["class_id", "academic_year_id", "status"]),
    ):
        if not _index_exists(table, name):
            op.create_index(name, table, columns)

    for table in ("attendance", "marks", "student_fees"):
        if not _column_exists(table, "enrollment_id"):
            op.add_column(table, sa.Column("enrollment_id", sa.Integer(), nullable=True))
            op.create_index(f"ix_{table}_enrollment_id", table, ["enrollment_id"])
            op.create_foreign_key(
                f"fk_{table}_enrollment_id",
                table,
                "enrollments",
                ["enrollment_id"],
                ["id"],
                ondelete="CASCADE",
            )

    if not _constraint_exists("attendance", "uq_attendance_enrollment_date"):
        op.create_unique_constraint("uq_attendance_enrollment_date", "attendance", ["enrollment_id", "date"])
    if not _constraint_exists("marks", "uq_mark_enrollment_subject_exam"):
        op.create_unique_constraint("uq_mark_enrollment_subject_exam", "marks", ["enrollment_id", "subject_id", "exam_id"])

    op.execute(
        """
        UPDATE attendance a
        SET enrollment_id = e.id
        FROM enrollments e
        JOIN classes c ON c.id = e.class_id
        WHERE a.enrollment_id IS NULL
          AND a.student_id = e.student_id
          AND a.class_id = e.class_id
          AND a.date BETWEEN (
              SELECT ay.start_date FROM academic_years ay WHERE ay.id = e.academic_year_id
          ) AND (
              SELECT ay.end_date FROM academic_years ay WHERE ay.id = e.academic_year_id
          )
        """
    )
    op.execute(
        """
        UPDATE marks m
        SET enrollment_id = e.id
        FROM enrollments e, exams ex
        WHERE m.enrollment_id IS NULL
          AND m.student_id = e.student_id
          AND ex.id = m.exam_id
          AND e.class_id = ex.class_id
          AND e.academic_year_id = ex.academic_year_id
        """
    )
    op.execute(
        """
        UPDATE student_fees sf
        SET enrollment_id = e.id
        FROM enrollments e
        WHERE sf.enrollment_id IS NULL
          AND sf.student_id = e.student_id
          AND sf.academic_year_id = e.academic_year_id
        """
    )


def downgrade() -> None:
    for table, name in (
        ("enrollments", "ix_enrollments_class_id_academic_year_id_status"),
        ("student_fees", "ix_student_fees_enrollment_id_academic_year_id"),
        ("marks", "ix_marks_exam_id_subject_id"),
        ("fee_payments", "ix_fee_payments_student_fee_id"),
        ("attendance", "ix_attendance_class_id_date"),
    ):
        if _index_exists(table, name):
            op.drop_index(name, table_name=table)

    for table, constraint in (
        ("marks", "uq_mark_enrollment_subject_exam"),
        ("attendance", "uq_attendance_enrollment_date"),
    ):
        if _constraint_exists(table, constraint):
            op.drop_constraint(constraint, table, type_="unique")

    for table in ("student_fees", "marks", "attendance"):
        fk = f"fk_{table}_enrollment_id"
        if _constraint_exists(table, fk):
            op.drop_constraint(fk, table, type_="foreignkey")
        op.drop_index(f"ix_{table}_enrollment_id", table_name=table)
        if _column_exists(table, "enrollment_id"):
            op.drop_column(table, "enrollment_id")
