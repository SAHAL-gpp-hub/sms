"""performance indexes

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-05-09
"""

from typing import Sequence, Union

from alembic import op


revision: str = "i9j0k1l2m3n4"
down_revision: Union[str, None] = "h8i9j0k1l2m3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE INDEX IF NOT EXISTS ix_students_academic_year_id ON students (academic_year_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_enrollments_class_year ON enrollments (class_id, academic_year_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fee_structures_class_year ON fee_structures (class_id, academic_year_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_student_fees_student_id ON student_fees (student_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_student_fees_academic_year_id ON student_fees (academic_year_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fee_payments_payment_date ON fee_payments (payment_date)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_fee_payments_payment_date")
    op.execute("DROP INDEX IF EXISTS ix_student_fees_academic_year_id")
    op.execute("DROP INDEX IF EXISTS ix_student_fees_student_id")
    op.execute("DROP INDEX IF EXISTS ix_fee_structures_class_year")
    op.execute("DROP INDEX IF EXISTS ix_enrollments_class_year")
    op.execute("DROP INDEX IF EXISTS ix_students_academic_year_id")
