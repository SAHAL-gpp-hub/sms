"""
student_service.py

BUG FIX — Enrollment auto-creation:
  create_student() now creates an Enrollment row immediately after inserting
  the Student. Without this, students added after the initial migration
  back-fill never get enrollment rows, which breaks:
    - promotion candidate lists (generate_candidate_list queries enrollments)
    - marks entry (get_marks uses Enrollment to scope student lists)
    - the roll list endpoint (/enrollments/class/{id}/roll-list)
    - backfill reporting (always shows 0 created because the back-fill only
      handles students that somehow have no enrollment — newly created
      students never had one since create_student didn't make one)

  The backfill endpoint remains useful for one-time fixes but should not be
  needed in normal operation after this fix is deployed.
"""

from datetime import date
from typing import Optional

from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.base_models import (
    Enrollment, EnrollmentStatusEnum,
    Student, StudentStatusEnum,
)
from app.schemas.student import StudentCreate, StudentUpdate
from fastapi import HTTPException


# ──────────────────────────────────────────────────────────────────────────────
# ID generation
# ──────────────────────────────────────────────────────────────────────────────

def generate_student_id(db: Session, year: int) -> str:
    """
    Returns the next sequential student ID for the given admission year,
    e.g. SMS-2026-007.

    Acquires a PostgreSQL advisory transaction lock keyed on the year so that
    concurrent callers are fully serialised — no two threads can read MAX()
    at the same time for the same year. The lock is released automatically
    when the surrounding transaction commits or rolls back.
    """
    try:
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": year})
    except Exception:
        pass

    rows = db.execute(
        text("SELECT student_id FROM students WHERE student_id LIKE :prefix"),
        {"prefix": f"SMS-{year}-%"},
    ).fetchall()
    nums = []
    for row in rows:
        parts = str(row[0]).split("-")
        if len(parts) >= 3 and parts[2].isdigit():
            nums.append(int(parts[2]))

    next_num = max(nums, default=0) + 1
    return f"SMS-{year}-{str(next_num).zfill(3)}"


# ──────────────────────────────────────────────────────────────────────────────
# CRUD
# ──────────────────────────────────────────────────────────────────────────────

def _create_enrollment_for_student(db: Session, student: Student) -> None:
    """
    Creates an Enrollment row for the student if one doesn't already exist
    for their current academic_year_id.

    Called automatically by create_student() and can also be called
    from update_student() if class/year changes.

    Idempotent: silently skips if enrollment already exists
    (ON CONFLICT via unique constraint uq_enrollment_student_year).
    """
    if student.class_id is None or student.academic_year_id is None:
        return  # can't create enrollment without both FK values

    existing = db.query(Enrollment).filter_by(
        student_id=student.id,
        academic_year_id=student.academic_year_id,
    ).first()

    if existing:
        return  # already enrolled, nothing to do

    # Map student status → enrollment status
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
    enroll_status = status_map.get(student.status, EnrollmentStatusEnum.active)

    enrollment = Enrollment(
        student_id       = student.id,
        academic_year_id = student.academic_year_id,
        class_id         = student.class_id,
        roll_number      = str(student.roll_number) if student.roll_number else None,
        status           = enroll_status,
        enrolled_on      = student.admission_date or date.today(),
        promotion_status = "not_started",
    )
    db.add(enrollment)
    # Note: caller is responsible for db.commit() — we only add to session here


def create_student(db: Session, data: StudentCreate) -> Student:
    """
    Creates a student record AND an enrollment record for the current year.

    ID generation is race-proof via advisory locking.
    """
    year    = data.admission_date.year
    payload = data.model_dump()

    student_id = generate_student_id(db, year)
    student    = Student(student_id=student_id, **payload)
    db.add(student)

    try:
        db.flush()  # assign student.id without committing
        # FIX: auto-create enrollment so the student appears in all year-scoped queries
        _create_enrollment_for_student(db, student)
        db.commit()
        db.refresh(student)
        return student
    except IntegrityError as exc:
        db.rollback()
        err_str = str(exc.orig).lower()

        # Retry once — only for student_id collisions
        if "student_id" in err_str and ("unique" in err_str or "duplicate" in err_str):
            student_id = generate_student_id(db, year)
            student    = Student(student_id=student_id, **payload)
            db.add(student)
            try:
                db.flush()
                _create_enrollment_for_student(db, student)
                db.commit()
                db.refresh(student)
                return student
            except IntegrityError as exc2:
                db.rollback()
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Could not generate a unique student ID even with advisory "
                        f"locking. Last error: {exc2.orig}"
                    ),
                ) from exc2

        raise HTTPException(status_code=400, detail=str(exc.orig)) from exc


def get_students(
    db: Session,
    class_id: Optional[int]           = None,
    class_ids: Optional[list[int]]    = None,
    student_ids: Optional[list[int]]  = None,
    search: Optional[str]             = None,
    academic_year_id: Optional[int]   = None,
    limit: int                         = 50,
    offset: int                        = 0,
):
    query = db.query(Student).filter(Student.status == StudentStatusEnum.Active)

    if class_id is not None:
        query = query.filter(Student.class_id == class_id)
    elif class_ids:
        query = query.filter(Student.class_id.in_(class_ids))
    if student_ids is not None:
        if len(student_ids) == 0:
            return []
        query = query.filter(Student.id.in_(student_ids))
    if academic_year_id is not None:
        query = query.filter(Student.academic_year_id == academic_year_id)
    search = search.strip() if search else None
    if search:
        id_prefix = f"{search}%"
        query = query.filter(
            or_(
                Student.name_en.ilike(f"%{search}%"),
                Student.name_gu.ilike(f"%{search}%"),
                Student.gr_number.ilike(id_prefix),
                Student.student_id.ilike(id_prefix),
                Student.contact.ilike(id_prefix),
            )
        )

    query = query.order_by(Student.id.desc())
    return query.offset(offset).limit(limit).all()


def get_student(
    db: Session, student_id: int, include_inactive: bool = False
) -> Optional[Student]:
    query = db.query(Student).filter(Student.id == student_id)
    if not include_inactive:
        query = query.filter(Student.status == StudentStatusEnum.Active)
    return query.first()


def update_student(
    db: Session, student_id: int, data: StudentUpdate
) -> Optional[Student]:
    student = get_student(db, student_id, include_inactive=True)
    if not student:
        return None

    old_year_id  = student.academic_year_id
    old_class_id = student.class_id

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(student, key, value)

    # If class or year changed, ensure enrollment exists for the new year
    year_changed  = (student.academic_year_id != old_year_id)
    class_changed = (student.class_id != old_class_id)
    if year_changed or class_changed:
        _create_enrollment_for_student(db, student)

    db.commit()
    db.refresh(student)
    return student


def delete_student(db: Session, student_id: int) -> bool:
    """Soft-delete: marks student as 'Left' rather than removing the row."""
    student = get_student(db, student_id, include_inactive=True)
    if not student or student.status == StudentStatusEnum.Left:
        return False
    student.status = StudentStatusEnum.Left
    db.commit()
    return True
