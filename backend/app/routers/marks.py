from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.schemas.marks import SubjectCreate, SubjectOut, ExamCreate, ExamOut, MarkEntry
from app.services import marks_service

router = APIRouter(prefix="/api/v1/marks", tags=["Marks"])

# Subjects
@router.get("/subjects", response_model=list[SubjectOut])
def get_subjects(class_id: int = Query(...), db: Session = Depends(get_db)):
    return marks_service.get_subjects(db, class_id)

@router.post("/subjects", response_model=SubjectOut, status_code=201)
def create_subject(data: SubjectCreate, db: Session = Depends(get_db)):
    return marks_service.create_subject(db, data)

@router.post("/subjects/seed/{class_id}")
def seed_subjects(class_id: int, db: Session = Depends(get_db)):
    count = marks_service.seed_subjects(db, class_id)
    return {"message": f"Seeded {count} subjects"}

@router.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    marks_service.delete_subject(db, subject_id)
    return {"message": "Deleted"}

# Exams
@router.get("/exams", response_model=list[ExamOut])
def get_exams(
    class_id: Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return marks_service.get_exams(db, class_id, academic_year_id)

@router.post("/exams", response_model=ExamOut, status_code=201)
def create_exam(data: ExamCreate, db: Session = Depends(get_db)):
    return marks_service.create_exam(db, data)

@router.delete("/exams/{exam_id}")
def delete_exam(exam_id: int, db: Session = Depends(get_db)):
    marks_service.delete_exam(db, exam_id)
    return {"message": "Deleted"}

# Marks entry
@router.get("/entry")
def get_marks(
    exam_id: int = Query(...),
    class_id: int = Query(...),
    db: Session = Depends(get_db)
):
    return marks_service.get_marks(db, exam_id, class_id)

@router.post("/bulk")
def bulk_save_marks(entries: list[MarkEntry], db: Session = Depends(get_db)):
    return marks_service.bulk_save_marks(db, entries)

# Results
@router.get("/results")
def get_results(
    exam_id: int = Query(...),
    class_id: int = Query(...),
    db: Session = Depends(get_db)
):
    return marks_service.get_class_results(db, exam_id, class_id)