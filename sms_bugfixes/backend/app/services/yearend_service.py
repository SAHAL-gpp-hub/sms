"""
yearend_service.py

FIXES APPLIED:
  - Bug 3: get_next_class_name() used CLASS_ORDER.index() which raises ValueError
           for any non-standard class name (e.g. "Std 5", custom names), caught
           silently and treated identically to Std 10 "end of ladder" — giving
           a misleading TC-suggest error for a perfectly valid class.
           Fixed: distinguish "unrecognised name" (400 with clear message) from
           "end of ladder" (400 with TC suggestion).
  - Bug 2 (yearend side): bulk_promote_students now sets the correct
           academic_year_id on both the Student row AND any newly created Class
           rows.  StudentFee rows from the old year retain their
           academic_year_id (written at assign-time by fee_service), so they
           remain queryable after promotion.
"""

from datetime import date

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.base_models import Student, Class, AcademicYear

# Canonical GSEB class progression
CLASS_ORDER = [
    "Nursery", "LKG", "UKG",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
]


def get_next_class_name(current_name: str) -> str:
    """
    BUG 3 FIX: Distinguish three cases clearly:
      1. current_name is in CLASS_ORDER and has a successor  → return successor
      2. current_name is "10" (end of ladder)               → return None
      3. current_name is not in CLASS_ORDER at all           → raise ValueError

    Previously case 3 was silently treated as case 2, so promoting any class
    with a non-standard name gave the "should be issued TCs" error instead of
    a "unrecognised class name" error.
    """
    if current_name not in CLASS_ORDER:
        raise ValueError(
            f"Class name '{current_name}' is not a recognised GSEB standard. "
            f"Expected one of: {', '.join(CLASS_ORDER)}."
        )
    idx = CLASS_ORDER.index(current_name)
    if idx + 1 >= len(CLASS_ORDER):
        return None   # end of ladder (Std 10)
    return CLASS_ORDER[idx + 1]


def bulk_promote_students(db: Session, class_id: int, new_academic_year_id: int):
    current_class = db.query(Class).filter_by(id=class_id).first()
    if not current_class:
        return {"error": "Class not found", "promoted": 0}

    try:
        next_class_name = get_next_class_name(current_class.name)
    except ValueError as exc:
        # BUG 3 FIX: unrecognised class name — return a clear, specific message
        return {"error": str(exc), "promoted": 0}

    if next_class_name is None:
        return {
            "error": (
                f"No class after Std {current_class.name}. "
                "Students in Std 10 should be issued Transfer Certificates."
            ),
            "promoted": 0,
        }

    students = db.query(Student).filter_by(
        class_id=class_id, status="Active"
    ).all()

    next_class = db.query(Class).filter_by(
        name=next_class_name,
        division=current_class.division,
        academic_year_id=new_academic_year_id,
    ).first()

    if not next_class:
        next_class = Class(
            name=next_class_name,
            division=current_class.division,
            academic_year_id=new_academic_year_id,
        )
        db.add(next_class)
        db.commit()
        db.refresh(next_class)

    promoted = 0
    for student in students:
        student.class_id         = next_class.id
        # BUG 2 (yearend side): update student to new year
        student.academic_year_id = new_academic_year_id
        promoted += 1

    db.commit()
    return {
        "promoted":   promoted,
        "from_class": current_class.name,
        "to_class":   next_class_name,
        "new_year_id": new_academic_year_id,
    }


def create_academic_year(
    db: Session, label: str, start_date: str, end_date: str
):
    existing = db.query(AcademicYear).filter_by(label=label).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Academic year '{label}' already exists",
        )

    # Unset current year
    db.query(AcademicYear).filter_by(is_current=True).update({"is_current": False})
    db.commit()

    new_year = AcademicYear(
        label=label,
        start_date=start_date,
        end_date=end_date,
        is_current=True,
    )
    db.add(new_year)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Academic year '{label}' already exists",
        )
    db.refresh(new_year)

    # Auto-create all standard classes for the new year
    from app.services.marks_service import GSEB_SUBJECTS
    for name in GSEB_SUBJECTS:
        exists = db.query(Class).filter_by(
            name=name, academic_year_id=new_year.id
        ).first()
        if not exists:
            db.add(Class(name=name, division="A", academic_year_id=new_year.id))
    db.commit()

    return new_year


def issue_tc(db: Session, student_id: int, reason: str = "Parent's Request"):
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        return None
    student.status = "TC Issued"
    db.commit()
    db.refresh(student)
    return student


def get_tc_data(db: Session, student_id: int, reason: str, conduct: str):
    # include_inactive=True so TCs work for Left/TC-Issued students too
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return None

    cls  = db.query(Class).filter_by(id=student.class_id).first()
    year = db.query(AcademicYear).filter_by(id=student.academic_year_id).first()

    tc_count  = db.query(Student).filter(Student.status == "TC Issued").count()
    tc_number = f"TC-{date.today().year}-{str(tc_count).zfill(4)}"

    # FIX (Issue 6): format dates as DD/MM/YYYY for GSEB TC
    def fmt(d):
        return d.strftime("%d/%m/%Y") if d else "—"

    return {
        "student":          student,
        "class_name":       cls.name if cls else "—",
        "division":         cls.division if cls else "A",
        "academic_year":    year.label if year else "2025-26",
        "tc_number":        tc_number,
        "issue_date":       fmt(date.today()),
        "leave_date":       fmt(date.today()),
        "reason":           reason,
        "conduct":          conduct,
        "promotion_status": "Promoted",
        # Formatted dates available in template as separate variables
        "dob_formatted":              fmt(student.dob),
        "admission_date_formatted":   fmt(student.admission_date),
    }
