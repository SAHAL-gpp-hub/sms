"""
enrollment_service.py

Manages the Enrollment table — the year-scoped central node that
attendance, marks, and fees should all reference.

Public functions:
  - get_enrollment()              : fetch a single enrollment
  - get_enrollment_for_student()  : student + year → enrollment
  - list_enrollments()            : query with filters
  - backfill_enrollments()        : one-time migration from Student rows
  - get_class_roll_list()         : ordered roll list for a class/year
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
    Used for attendance, marks entry, and printing.
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
            "enrollment_id":  enroll.id,
            "student_id":     student.id,
            "student_name":   student.name_en,
            "student_name_gu": student.name_gu,
            "gr_number":      student.gr_number,
            "roll_number":    enroll.roll_number,
            "status":         enroll.status.value if hasattr(enroll.status, "value") else enroll.status,
            "gender":         student.gender.value if hasattr(student.gender, "value") else student.gender,
            "contact":        student.contact,
        })
    return result


def backfill_enrollments(db: Session) -> dict:
    """
    One-time migration: creates Enrollment rows for all existing Students
    who don't already have one for their current academic_year_id.
    Safe to call multiple times (idempotent via unique constraint).
    """
    students = db.query(Student).filter(
        Student.class_id != None,         # noqa: E711
        Student.academic_year_id != None, # noqa: E711
    ).all()

    created = 0
    skipped = 0

    for student in students:
        existing = db.query(Enrollment).filter_by(
            student_id=student.id,
            academic_year_id=student.academic_year_id,
        ).first()

        if existing:
            skipped += 1
            continue

        status_map = {
            StudentStatusEnum.Active:     EnrollmentStatusEnum.active,
            StudentStatusEnum.TC_Issued:  EnrollmentStatusEnum.transferred,
            StudentStatusEnum.Left:       EnrollmentStatusEnum.dropped,
            StudentStatusEnum.Passed_Out: EnrollmentStatusEnum.graduated,
            StudentStatusEnum.Alumni:     EnrollmentStatusEnum.graduated,
            StudentStatusEnum.Detained:   EnrollmentStatusEnum.retained,
            StudentStatusEnum.Provisional: EnrollmentStatusEnum.provisional,
            StudentStatusEnum.On_Hold:    EnrollmentStatusEnum.on_hold,
        }
        enroll_status = status_map.get(student.status, EnrollmentStatusEnum.active)

        enrollment = Enrollment(
            student_id       = student.id,
            academic_year_id = student.academic_year_id,
            class_id         = student.class_id,
            roll_number      = str(student.roll_number) if student.roll_number else None,
            status           = enroll_status,
            enrolled_on      = student.admission_date or date.today(),
            promotion_status = "completed",   # existing data = already placed
        )
        db.add(enrollment)
        created += 1

    db.commit()
    return {"created": created, "skipped": skipped, "total": len(students)}


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

    # Fetch students for sorting
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
    # else sequential = current order

    for i, enroll in enumerate(enrollments, start=1):
        enroll.roll_number = str(i)
        student = student_map.get(enroll.student_id)
        if student:
            student.roll_number = i   # keep legacy field in sync

    db.commit()
    return {"reassigned": len(enrollments)}