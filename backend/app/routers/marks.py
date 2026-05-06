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
from app.models.base_models import Class, Exam, Student, Subject
from app.routers.auth import (
    CurrentUser,
    ensure_class_access,
    ensure_student_access,
    ensure_subject_assignment_access,
    require_role,
)
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
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    if class_id:
        ensure_class_access(current_user, class_id)
        subjects = marks_service.get_subjects(db, class_id, include_inactive)
        if current_user.role == "teacher":
            allowed_subject_ids = {
                a["subject_id"]
                for a in current_user.subject_assignments
                if a["class_id"] == class_id
            }
            subjects = [s for s in subjects if s.id in allowed_subject_ids]
        return subjects
    if standard is not None:
        cls = db.query(Class).filter(Class.name == str(standard)).first()
        if cls:
            ensure_class_access(current_user, cls.id)
        if not cls:
            return []
        subjects = marks_service.get_subjects(db, cls.id, include_inactive)
        if current_user.role == "teacher":
            allowed_subject_ids = {
                a["subject_id"]
                for a in current_user.subject_assignments
                if a["class_id"] == cls.id
            }
            subjects = [s for s in subjects if s.id in allowed_subject_ids]
        return subjects
    return []


@router.post("/subjects", response_model=SubjectOut, status_code=201)
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    try:
        return marks_service.create_subject(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
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
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Soft-deletes if mark history exists; hard-deletes otherwise.
    Returns {"deleted": true, "soft": true/false}.
    """
    subject = marks_service.delete_subject(db, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"deleted": True, "soft": not subject.is_active if hasattr(subject, 'is_active') else False}


@router.post("/subjects/seed/{class_id}")
def seed_subjects_by_path(
    class_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    count = marks_service.seed_subjects(db, class_id)
    return {"message": f"Seeded {count} subjects"}


@router.post("/subjects/seed")
def seed_subjects_by_body(
    data: SeedRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
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
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    if class_id:
        ensure_class_access(current_user, class_id)
    return marks_service.get_exams(db, class_id, academic_year_id)


@router.post("/exams", response_model=ExamOut, status_code=201)
def create_exam(
    data: ExamCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    return marks_service.create_exam(db, data)


@router.delete("/exams/{exam_id}")
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
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
def get_exam_configs(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    exam = db.query(Exam).filter_by(id=exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    ensure_class_access(current_user, exam.class_id)
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
    _: CurrentUser = Depends(require_role("admin")),
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
def clear_exam_configs(
    exam_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
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
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    ensure_class_access(current_user, class_id)
    """
    Returns {students: [...], subjects: [...]}.
    Each subject now includes:
      - max_theory / max_practical   : EFFECTIVE values for this exam
      - default_max_theory/practical : original subject defaults
      - has_custom_config            : whether an override is active
    """
    allowed_subject_ids = None
    if current_user.role == "teacher":
        allowed_subject_ids = [
            a["subject_id"]
            for a in current_user.subject_assignments
            if a["class_id"] == class_id
        ]
        if not allowed_subject_ids:
            raise HTTPException(
                status_code=403,
                detail="You are not assigned to any subjects for this class",
            )
    return marks_service.get_marks(db, exam_id, class_id, allowed_subject_ids)


@router.post("/bulk")
def bulk_save_marks(
    entries: list[MarkEntry],
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    if current_user.role == "teacher":
        if not entries:
            return {"saved": 0}
        student_ids = {entry.student_id for entry in entries}
        students = db.query(Student).filter(Student.id.in_(student_ids)).all()
        found_ids = {student.id for student in students}
        missing_ids = student_ids - found_ids
        if missing_ids:
            raise HTTPException(status_code=404, detail=f"Students not found: {sorted(missing_ids)}")
        students_by_id = {student.id: student for student in students}
        exam_ids = {entry.exam_id for entry in entries}
        subject_ids = {entry.subject_id for entry in entries}
        exams = db.query(Exam).filter(Exam.id.in_(exam_ids)).all()
        subjects = db.query(Subject).filter(Subject.id.in_(subject_ids)).all()
        exams_by_id = {exam.id: exam for exam in exams}
        subjects_by_id = {subject.id: subject for subject in subjects}
        if missing_exam_ids := exam_ids - set(exams_by_id):
            raise HTTPException(status_code=404, detail=f"Exams not found: {sorted(missing_exam_ids)}")
        if missing_subject_ids := subject_ids - set(subjects_by_id):
            raise HTTPException(status_code=404, detail=f"Subjects not found: {sorted(missing_subject_ids)}")
        for entry in entries:
            student = students_by_id[entry.student_id]
            exam = exams_by_id[entry.exam_id]
            subject = subjects_by_id[entry.subject_id]
            if student.class_id != exam.class_id:
                raise HTTPException(
                    status_code=422,
                    detail=f"Student {student.id} does not belong to exam class {exam.class_id}",
                )
            if subject.class_id != exam.class_id:
                raise HTTPException(
                    status_code=422,
                    detail=f"Subject {subject.id} does not belong to exam class {exam.class_id}",
                )
            ensure_subject_assignment_access(current_user, exam.class_id, subject.id)
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
    current_user: CurrentUser = Depends(require_role("admin", "teacher", "student", "parent")),
):
    if class_id:
        if current_user.role not in ("admin", "teacher"):
            raise HTTPException(status_code=403, detail="Use student_id to view scoped results")
        ensure_class_access(current_user, class_id)
        return marks_service.get_class_results(db, exam_id, class_id)
    if student_id:
        ensure_student_access(db, current_user, student_id)
        student = db.query(Student).filter_by(id=student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        results = marks_service.get_class_results(db, exam_id, student.class_id)
        match = next((r for r in results if r["student_id"] == student_id), None)
        if not match:
            raise HTTPException(status_code=404, detail="No marks found for this student")
        return match
    raise HTTPException(status_code=422, detail="Provide class_id or student_id")
