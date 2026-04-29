"""
app/routers/marks.py  (updated)

New endpoints:
  PATCH /marks/subjects/{subject_id}        — edit a subject (name/marks/type)
  DELETE /marks/subjects/{subject_id}       — soft or hard delete a subject
  GET    /marks/exams/{exam_id}/configs     — get per-exam max-marks overrides
  PUT    /marks/exams/{exam_id}/configs     — replace all overrides for an exam
  DELETE /marks/exams/{exam_id}/configs     — clear all overrides (revert to defaults)

Existing endpoints are unchanged so all current tests continue to pass.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.base_models import Class
from app.schemas.marks import (
    SubjectCreate, SubjectUpdate, SubjectOut,
    ExamCreate, ExamOut,
    ExamSubjectConfigCreate, ExamSubjectConfigOut, ExamSubjectConfigBulk,
    MarkEntry,
)
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
    class_id:         Optional[int]  = Query(None),
    standard:         Optional[int]  = Query(None),
    include_inactive: bool           = Query(False),
    db: Session = Depends(get_db),
):
    if class_id:
        return marks_service.get_subjects(db, class_id, include_inactive)
    if standard is not None:
        cls = db.query(Class).filter(Class.name == str(standard)).first()
        if not cls:
            return []
        return marks_service.get_subjects(db, cls.id, include_inactive)
    return []


@router.post("/subjects", response_model=SubjectOut, status_code=201)
def create_subject(data: SubjectCreate, db: Session = Depends(get_db)):
    try:
        return marks_service.create_subject(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
):
    """
    Partial update — only send the fields you want to change.
    Supports: name, max_theory, max_practical, subject_type, is_active.
    """
    try:
        subject = marks_service.update_subject(db, subject_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    """
    Soft-deletes if mark history exists; hard-deletes otherwise.
    Returns {"deleted": true, "soft": true/false}.
    """
    subject = marks_service.delete_subject(db, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"deleted": True, "soft": not subject.is_active if hasattr(subject, 'is_active') else False}


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
# Exam Subject Configs (per-exam max-marks overrides)
# ---------------------------------------------------------------------------

@router.get(
    "/exams/{exam_id}/configs",
    response_model=list[ExamSubjectConfigOut],
    summary="Get per-exam max-marks overrides",
)
def get_exam_configs(exam_id: int, db: Session = Depends(get_db)):
    """
    Returns all ExamSubjectConfig rows for this exam.
    Subjects NOT in this list use their subject-level defaults.
    """
    return marks_service.get_exam_subject_configs(db, exam_id)


@router.put(
    "/exams/{exam_id}/configs",
    response_model=list[ExamSubjectConfigOut],
    summary="Replace all per-exam max-marks overrides",
)
def set_exam_configs(
    exam_id: int,
    data: ExamSubjectConfigBulk,
    db: Session = Depends(get_db),
):
    """
    Replaces ALL override rows for this exam with the provided list.
    Send an empty configs list to clear all overrides (revert to defaults).

    Example body (Unit Test with 25 marks per subject):
    {
      "configs": [
        {"subject_id": 1, "max_theory": 25, "max_practical": 0},
        {"subject_id": 2, "max_theory": 25, "max_practical": 0}
      ]
    }
    """
    try:
        return marks_service.upsert_exam_subject_configs(db, exam_id, data.configs)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete(
    "/exams/{exam_id}/configs",
    summary="Clear all per-exam max-marks overrides (revert to subject defaults)",
)
def clear_exam_configs(exam_id: int, db: Session = Depends(get_db)):
    try:
        marks_service.upsert_exam_subject_configs(db, exam_id, [])
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"message": "All exam subject configs cleared"}


# ---------------------------------------------------------------------------
# Marks entry
# ---------------------------------------------------------------------------

@router.get("/entry")
def get_marks(
    exam_id:  int = Query(...),
    class_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Returns {students: [...], subjects: [...]}.
    Each subject now includes:
      - max_theory / max_practical   : EFFECTIVE values for this exam
      - default_max_theory/practical : original subject defaults
      - has_custom_config            : whether an override is active
    """
    return marks_service.get_marks(db, exam_id, class_id)


@router.post("/bulk")
def bulk_save_marks(entries: list[MarkEntry], db: Session = Depends(get_db)):
    try:
        return marks_service.bulk_save_marks(db, entries)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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