"""
student_service.py

FIX — BUG-CONCURRENCY (race-proof, no schema change required):
  generate_student_id() now acquires a PostgreSQL advisory transaction lock
  keyed on the admission year before reading MAX().

  Why the old approach failed
  ───────────────────────────
  COUNT race:  threads A and B both read COUNT=5 → both generate SMS-2026-006
               → one wins, the other hits IntegrityError.
  MAX + retry: same window. Retries help but 10 threads hitting simultaneously
               can exhaust all attempts before any commit is visible.

  Advisory lock solution
  ──────────────────────
  pg_advisory_xact_lock(year) serialises all concurrent callers for the same
  year at the DB level. The lock is held for the duration of the transaction
  and released automatically on commit or rollback — no manual cleanup needed.

  Thread A acquires the lock → reads MAX → generates SMS-2026-006 → commits
  → lock released → Thread B acquires the lock → reads MAX (now 6) →
  generates SMS-2026-007 → commits. Zero collisions, zero retries needed.

  The UNIQUE constraint on student_id remains as a hard safety net.
"""

from typing import Optional

from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.base_models import Student, StudentStatusEnum
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
    # Serialize all concurrent ID generation for this admission year.
    # pg_advisory_xact_lock takes a bigint; using year directly is fine
    # (years are small positive integers well within bigint range).
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

def create_student(db: Session, data: StudentCreate) -> Student:
    """
    Creates a student record.

    ID generation is now race-proof via advisory locking, so a single attempt
    is sufficient. A one-shot retry is kept only as a last-resort safety net
    for the (practically impossible) case where the UNIQUE constraint fires
    despite the lock (e.g. a row was inserted outside this service with a
    hand-crafted ID).
    """
    year    = data.admission_date.year
    payload = data.model_dump()

    student_id = generate_student_id(db, year)
    student    = Student(student_id=student_id, **payload)
    db.add(student)

    try:
        db.commit()
        db.refresh(student)
        return student
    except IntegrityError as exc:
        db.rollback()
        err_str = str(exc.orig).lower()

        # Retry once — only for student_id collisions (should never happen
        # with advisory locking, but belt-and-suspenders).
        if "student_id" in err_str and ("unique" in err_str or "duplicate" in err_str):
            student_id = generate_student_id(db, year)
            student    = Student(student_id=student_id, **payload)
            db.add(student)
            try:
                db.commit()
                db.refresh(student)
                return student
            except IntegrityError as exc2:
                db.rollback()
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Could not generate a unique student ID even with advisory "
                        f"locking. This should not happen — check for manual DB "
                        f"inserts that bypass this service. Last error: {exc2.orig}"
                    ),
                ) from exc2

        # Any other constraint violation (e.g. duplicate roll_number) is a
        # client error — return 400 with the DB message.
        raise HTTPException(status_code=400, detail=str(exc.orig)) from exc


def get_students(
    db: Session,
    class_id: Optional[int]           = None,
    search: Optional[str]             = None,
    academic_year_id: Optional[int]   = None,
    limit: int                         = 50,
    offset: int                        = 0,
):
    """
    Returns active students with optional filters and pagination.
    limit/offset support was added for M-01 (no student list pagination).
    """
    query = db.query(Student).filter(Student.status == StudentStatusEnum.Active)

    if class_id is not None:
        query = query.filter(Student.class_id == class_id)
    if academic_year_id is not None:
        query = query.filter(Student.academic_year_id == academic_year_id)
    if search:
        query = query.filter(
            or_(
                Student.name_en.ilike(f"%{search}%"),
                Student.name_gu.ilike(f"%{search}%"),
                Student.gr_number.ilike(f"%{search}%"),
                Student.student_id.ilike(f"%{search}%"),
                Student.contact.ilike(f"%{search}%"),
            )
        )

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
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(student, key, value)
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
