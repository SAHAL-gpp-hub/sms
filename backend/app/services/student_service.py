from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.base_models import Student, AcademicYear
from app.schemas.student import StudentCreate, StudentUpdate
from datetime import date

def generate_student_id(db: Session, year: int) -> str:
    count = db.query(Student).filter(
        Student.student_id.like(f"SMS-{year}-%")
    ).count()
    return f"SMS-{year}-{str(count + 1).zfill(3)}"

def create_student(db: Session, data: StudentCreate) -> Student:
    year = data.admission_date.year
    student_id = generate_student_id(db, year)
    student = Student(
        student_id=student_id,
        **data.model_dump()
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student

def get_students(db: Session, class_id: int = None, search: str = None, academic_year_id: int = None):
    query = db.query(Student)
    if class_id:
        query = query.filter(Student.class_id == class_id)
    if academic_year_id:
        query = query.filter(Student.academic_year_id == academic_year_id)
    if search:
        query = query.filter(
            or_(
                Student.name_en.ilike(f"%{search}%"),
                Student.gr_number.ilike(f"%{search}%"),
                Student.student_id.ilike(f"%{search}%"),
                Student.contact.ilike(f"%{search}%"),
            )
        )
    return query.filter(Student.status != "Left").all()

def get_student(db: Session, student_id: int) -> Student:
    return db.query(Student).filter(Student.id == student_id).first()

def update_student(db: Session, student_id: int, data: StudentUpdate) -> Student:
    student = get_student(db, student_id)
    if not student:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(student, key, value)
    db.commit()
    db.refresh(student)
    return student

def delete_student(db: Session, student_id: int) -> bool:
    student = get_student(db, student_id)
    if not student:
        return False
    student.status = "Left"
    db.commit()
    return True