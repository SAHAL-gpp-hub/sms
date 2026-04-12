"""
app/routers/marks.py

ISSUE 7 FIX: The /grid endpoint stripped the 'subjects' key from the
get_marks() response.  Any consumer relying on /grid for subject metadata
(e.g. to know max marks per subject) received an incomplete response.
Fixed: /grid now returns the full {students, subjects} shape identical to
/entry.  Tests that expected a raw list from /grid are updated in test_marks.py.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.schemas.marks import SubjectCreate, SubjectOut, ExamCreate, ExamOut, MarkEntry
from app.services import marks_service

router = APIRouter(prefix="/api/v1/marks", tags=["Marks"])


class SeedRequest(BaseModel):
    standard: Optional[int] = None
    class_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Subjects
# ---------------------------------------------------------------------------

@router.get("/subjects", response_model=list[SubjectOut])
def get_subjects(
    class_id: Optional[int] = Query(None),
    standard: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    if class_id:
        return marks_service.get_subjects(db, class_id)
    if standard:
        return marks_service.get_subjects(db, standard)
    return []


@router.post("/subjects", response_model=SubjectOut, status_code=201)
def create_subject(data: SubjectCreate, db: Session = Depends(get_db)):
    return marks_service.create_subject(db, data)


@router.post("/subjects/seed/{class_id}")
def seed_subjects_by_path(class_id: int, db: Session = Depends(get_db)):
    count = marks_service.seed_subjects(db, class_id)
    return {"message": f"Seeded {count} subjects"}


@router.post("/subjects/seed")
def seed_subjects_by_body(data: SeedRequest, db: Session = Depends(get_db)):
    target_id = data.class_id or data.standard
    if not target_id:
        raise HTTPException(status_code=422, detail="Provide class_id or standard")
    count = marks_service.seed_subjects(db, target_id)
    return {"message": f"Seeded {count} subjects"}


@router.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    marks_service.delete_subject(db, subject_id)
    return {"message": "Deleted"}


# ---------------------------------------------------------------------------
# Exams
# ---------------------------------------------------------------------------

@router.get("/exams", response_model=list[ExamOut])
def get_exams(
    class_id:         Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return marks_service.get_exams(db, class_id, academic_year_id)


@router.post("/exams", response_model=ExamOut, status_code=201)
def create_exam(data: ExamCreate, db: Session = Depends(get_db)):
    return marks_service.create_exam(db, data)


@router.delete("/exams/{exam_id}")
def delete_exam(exam_id: int, db: Session = Depends(get_db)):
    marks_service.delete_exam(db, exam_id)
    return {"message": "Deleted"}


# ---------------------------------------------------------------------------
# Marks entry
# ---------------------------------------------------------------------------

@router.get("/entry")
def get_marks(
    exam_id:  int = Query(...),
    class_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Returns {students: [...], subjects: [...]}."""
    return marks_service.get_marks(db, exam_id, class_id)


@router.get("/grid")
def get_marks_grid(
    exam_id:  int = Query(...),
    class_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    ISSUE 7 FIX: Previously stripped the 'subjects' key, returning only the
    students list.  Now returns the full {students, subjects} object identical
    to /entry so any consumer gets complete subject metadata.

    Tests that expected a raw list from /grid are updated in test_marks.py to
    use r.json().get("students", []) or handle both shapes.
    """
    return marks_service.get_marks(db, exam_id, class_id)


@router.post("/bulk")
def bulk_save_marks(entries: list[MarkEntry], db: Session = Depends(get_db)):
    return marks_service.bulk_save_marks(db, entries)


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

@router.get("/results")
def get_results(
    exam_id:    int            = Query(...),
    class_id:   Optional[int]  = Query(None),
    student_id: Optional[int]  = Query(None),
    db: Session = Depends(get_db),
):
    if class_id:
        return marks_service.get_class_results(db, exam_id, class_id)
    if student_id:
        from app.models.base_models import Student
        student = db.query(Student).filter_by(id=student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        results = marks_service.get_class_results(db, exam_id, student.class_id)
        match = next((r for r in results if r["student_id"] == student_id), None)
        if not match:
            raise HTTPException(status_code=404, detail="No marks found for this student")
        return match
    raise HTTPException(status_code=422, detail="Provide class_id or student_id")
