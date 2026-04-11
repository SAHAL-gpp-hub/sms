from datetime import date
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.base_models import Student
from app.schemas.student import StudentCreate, StudentUpdate


def generate_student_id(db: Session, year: int) -> str:
    count = db.query(Student).filter(Student.student_id.like(f"SMS-{year}-%")).count()
    return f"SMS-{year}-{str(count + 1).zfill(3)}"


def create_student(db: Session, data: StudentCreate) -> Student:
    year = data.admission_date.year
    student_id = generate_student_id(db, year)
    student = Student(student_id=student_id, **data.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def get_students(
    db: Session,
    class_id: Optional[int] = None,
    search: Optional[str] = None,
    academic_year_id: Optional[int] = None,
):
    query = db.query(Student).filter(Student.status == "Active")

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

    return query.all()


def get_student(db: Session, student_id: int, include_inactive: bool = False) -> Optional[Student]:
    query = db.query(Student).filter(Student.id == student_id)
    if not include_inactive:
        query = query.filter(Student.status == "Active")
    return query.first()


def update_student(db: Session, student_id: int, data: StudentUpdate) -> Optional[Student]:
    student = get_student(db, student_id, include_inactive=True)
    if not student:
        return None

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(student, key, value)

    db.commit()
    db.refresh(student)
    return student


def delete_student(db: Session, student_id: int) -> bool:
    student = get_student(db, student_id, include_inactive=True)
    if not student or student.status == "Left":
        return False

    student.status = "Left"
    db.commit()
    return True
