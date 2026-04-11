from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.base_models import Student, Class, AcademicYear
from datetime import date
from fastapi import HTTPException

CLASS_ORDER = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]

def get_next_class_name(current_name: str) -> str | None:
    try:
        idx = CLASS_ORDER.index(current_name)
        if idx + 1 < len(CLASS_ORDER):
            return CLASS_ORDER[idx + 1]
    except ValueError:
        pass
    return None

def bulk_promote_students(db: Session, class_id: int, new_academic_year_id: int):
    current_class = db.query(Class).filter_by(id=class_id).first()
    if not current_class:
        return {"error": "Class not found", "promoted": 0}

    next_class_name = get_next_class_name(current_class.name)
    if not next_class_name:
        # Std 10 has no next class — return error
        return {"error": f"No class after Std {current_class.name}. Students in Std 10 should be issued Transfer Certificates.", "promoted": 0}

    students = db.query(Student).filter_by(
        class_id=class_id, status="Active"
    ).all()

    next_class = db.query(Class).filter_by(
        name=next_class_name,
        division=current_class.division,
        academic_year_id=new_academic_year_id
    ).first()

    if not next_class:
        next_class = Class(
            name=next_class_name,
            division=current_class.division,
            academic_year_id=new_academic_year_id
        )
        db.add(next_class)
        db.commit()
        db.refresh(next_class)

    promoted = 0
    for student in students:
        student.class_id = next_class.id
        student.academic_year_id = new_academic_year_id
        promoted += 1

    db.commit()
    return {
        "promoted": promoted,
        "from_class": current_class.name,
        "to_class": next_class_name,
        "new_year_id": new_academic_year_id
    }

def create_academic_year(db: Session, label: str, start_date: str, end_date: str):
    # Check if label already exists
    existing = db.query(AcademicYear).filter_by(label=label).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Academic year '{label}' already exists")

    # Unset current year
    db.query(AcademicYear).filter_by(is_current=True).update({"is_current": False})
    db.commit()

    new_year = AcademicYear(
        label=label,
        start_date=start_date,
        end_date=end_date,
        is_current=True
    )
    db.add(new_year)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Academic year '{label}' already exists")
    db.refresh(new_year)

    # Create classes for new year
    from app.services.marks_service import GSEB_SUBJECTS
    class_names = list(GSEB_SUBJECTS.keys())
    for name in class_names:
        existing_cls = db.query(Class).filter_by(name=name, academic_year_id=new_year.id).first()
        if not existing_cls:
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
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        return None

    cls = db.query(Class).filter_by(id=student.class_id).first()
    year = db.query(AcademicYear).filter_by(id=student.academic_year_id).first()

    tc_count = db.query(Student).filter(
        Student.status == "TC Issued"
    ).count()
    tc_number = f"TC-{date.today().year}-{str(tc_count).zfill(4)}"

    return {
        "student": student,
        "class_name": cls.name if cls else "—",
        "division": cls.division if cls else "A",
        "academic_year": year.label if year else "2025-26",
        "tc_number": tc_number,
        "issue_date": date.today().strftime("%d/%m/%Y"),
        "leave_date": date.today().strftime("%d/%m/%Y"),
        "reason": reason,
        "conduct": conduct,
        "promotion_status": "Promoted"
    }
