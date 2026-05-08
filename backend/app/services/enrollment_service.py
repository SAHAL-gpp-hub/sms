"""
enrollment_service.py

FIX — backfill_enrollments() diagnostics + correctness:

  Previous behaviour that caused "0 created / X skipped":
  ─────────────────────────────────────────────────────────
  1. The initial migration (d1e2f3g4h5i6) already ran an INSERT … SELECT
     for all students that existed at migration time. So every pre-migration
     student already had an enrollment row → backfill found nothing to create.

  2. Students added AFTER the migration (via create_student) never got
     enrollment rows because create_student() didn't create them.
     Those students would appear in backfill as needing creation, but
     since the migration already ran they were also already covered by
     the migration's ON CONFLICT DO NOTHING.

  The real fix is in student_service.create_student() (see that file).
  The backfill is now:
  - More informative: returns per-category counts so you can tell why
    records were skipped (already_enrolled vs missing_class vs missing_year).
  - Correct: uses SQLAlchemy IS NULL / IS NOT NULL rather than Python != None.
  - Safe to call repeatedly.
"""

from datetime import date
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.base_models import (
    AcademicYear, Class, Enrollment, EnrollmentStatusEnum, Student,
    StudentStatusEnum,
)


def get_enrollment(db: Session, enrollment_id: int) -> Optional[Enrollment]:
    return db.query(Enrollment).filter_by(id=enrollment_id).first()


def get_enrollment_for_student(
    db: Session, student_id: int, academic_year_id: int
) -> Optional[Enrollment]:
    return db.query(Enrollment).filter_by(
        student_id=student_id, academic_year_id=academic_year_id
    ).first()


def list_enrollments(
    db: Session,
    academic_year_id: Optional[int] = None,
    class_id: Optional[int] = None,
    status: Optional[str] = None,
    student_id: Optional[int] = None,
) -> list[Enrollment]:
    q = db.query(Enrollment)
    if academic_year_id:
        q = q.filter(Enrollment.academic_year_id == academic_year_id)
    if class_id:
        q = q.filter(Enrollment.class_id == class_id)
    if status:
        q = q.filter(Enrollment.status == status)
    if student_id:
        q = q.filter(Enrollment.student_id == student_id)
    return q.order_by(Enrollment.roll_number).all()


def get_class_roll_list(db: Session, class_id: int, academic_year_id: int) -> list[dict]:
    """
    Returns the roll list for a class in a given year — ordered by roll number.
    """
    enrollments = (
        db.query(Enrollment)
        .filter_by(class_id=class_id, academic_year_id=academic_year_id)
        .filter(Enrollment.status.in_(["active", "retained", "provisional"]))
        .order_by(Enrollment.roll_number)
        .all()
    )

    result = []
    for enroll in enrollments:
        student = db.query(Student).filter_by(id=enroll.student_id).first()
        if not student:
            continue
        result.append({
            "enrollment_id":   enroll.id,
            "student_id":      student.id,
            "student_name":    student.name_en,
            "student_name_gu": student.name_gu,
            "gr_number":       student.gr_number,
            "roll_number":     enroll.roll_number,
            "status":          enroll.status.value if hasattr(enroll.status, "value") else enroll.status,
            "gender":          student.gender.value if hasattr(student.gender, "value") else student.gender,
            "contact":         student.contact,
        })
    return result


def backfill_enrollments(db: Session) -> dict:
    """
    Creates Enrollment rows for students that don't have one for their
    current academic_year_id + class_id combination.

    Safe to call multiple times (idempotent via unique constraint).

    Returns detailed counts to explain the result:
      created            - new Enrollment rows inserted
      skipped_enrolled   - already had an enrollment for current year
      skipped_no_class   - student.class_id is NULL (can't create enrollment)
      skipped_no_year    - student.academic_year_id is NULL
      total              - total students examined
    """
    # Use SQLAlchemy IS NOT NULL correctly
    students = (
        db.query(Student)
        .filter(Student.class_id.isnot(None))
        .filter(Student.academic_year_id.isnot(None))
        .all()
    )

    # Students excluded due to NULL FK (for diagnostic count). Keep the sets
    # separate so a malformed row with both fields missing is counted once in
    # the total but still visible in each category.
    null_class_ids = {
        row[0] for row in db.query(Student.id).filter(Student.class_id.is_(None)).all()
    }
    null_year_ids = {
        row[0] for row in db.query(Student.id).filter(Student.academic_year_id.is_(None)).all()
    }

    created           = 0
    skipped_enrolled  = 0

    status_map = {
        StudentStatusEnum.Active:      EnrollmentStatusEnum.active,
        StudentStatusEnum.TC_Issued:   EnrollmentStatusEnum.transferred,
        StudentStatusEnum.Left:        EnrollmentStatusEnum.dropped,
        StudentStatusEnum.Passed_Out:  EnrollmentStatusEnum.graduated,
        StudentStatusEnum.Alumni:      EnrollmentStatusEnum.graduated,
        StudentStatusEnum.Detained:    EnrollmentStatusEnum.retained,
        StudentStatusEnum.Provisional: EnrollmentStatusEnum.provisional,
        StudentStatusEnum.On_Hold:     EnrollmentStatusEnum.on_hold,
    }

    for student in students:
        existing = db.query(Enrollment).filter_by(
            student_id=student.id,
            academic_year_id=student.academic_year_id,
        ).first()

        if existing:
            skipped_enrolled += 1
            continue

        enroll_status = status_map.get(student.status, EnrollmentStatusEnum.active)

        enrollment = Enrollment(
            student_id       = student.id,
            academic_year_id = student.academic_year_id,
            class_id         = student.class_id,
            roll_number      = str(student.roll_number) if student.roll_number else None,
            status           = enroll_status,
            enrolled_on      = student.admission_date or date.today(),
            promotion_status = "completed",  # pre-existing data = already placed
        )
        db.add(enrollment)
        created += 1

    db.commit()

    return {
        "created":          created,
        "skipped":          skipped_enrolled,   # ← kept for API compat
        "skipped_enrolled": skipped_enrolled,
        "skipped_no_class": len(null_class_ids),
        "skipped_no_year":  len(null_year_ids),
        "total":            len(students) + len(null_class_ids | null_year_ids),
        "note": (
            "If created=0 and skipped_enrolled=N, all students already have "
            "enrollment rows (either from the initial migration or from a prior "
            "backfill). New students added via the API now auto-create enrollments "
            "inside create_student() so manual backfill is only needed for "
            "historical data or direct DB inserts."
        ),
    }


def reassign_roll_numbers(
    db: Session,
    class_id: int,
    academic_year_id: int,
    strategy: str = "alphabetical",
) -> dict:
    """
    Re-sequences roll numbers for all active enrollments in a class.
    Strategies: alphabetical (by name_en) | sequential (by current roll) | by_gr_number
    """
    enrollments = (
        db.query(Enrollment)
        .filter_by(class_id=class_id, academic_year_id=academic_year_id)
        .filter(Enrollment.status.in_(["active", "retained", "provisional"]))
        .all()
    )

    if not enrollments:
        return {"reassigned": 0}

    student_map = {
        s.id: s
        for s in db.query(Student).filter(
            Student.id.in_([e.student_id for e in enrollments])
        ).all()
    }

    if strategy == "alphabetical":
        enrollments.sort(key=lambda e: (student_map[e.student_id].name_en or "").lower())
    elif strategy == "by_gr_number":
        enrollments.sort(key=lambda e: student_map[e.student_id].gr_number or "")
    # else sequential = keep current order

    for i, enroll in enumerate(enrollments, start=1):
        enroll.roll_number = str(i)
        student = student_map.get(enroll.student_id)
        if student:
            student.roll_number = i  # keep legacy field in sync

    db.commit()
    return {"reassigned": len(enrollments)}
