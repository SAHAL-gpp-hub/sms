from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional, Union
from pydantic import BaseModel
from app.core.database import get_db
from app.core.cache import response_cache
from app.core.config import settings
from app.models.base_models import Class, Enrollment, Student
from app.routers.auth import (
    CurrentUser,
    ensure_class_access,
    ensure_class_teacher_access,
    require_role,
)
from app.schemas.attendance import AttendanceBulk, AttendanceOut, AttendanceEntry
from app.services import attendance_service

router = APIRouter(prefix="/api/v1/attendance", tags=["Attendance"])

@router.get("/daily")
def get_daily_attendance(
    class_id: int = Query(...),
    date: date = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    ensure_class_teacher_access(current_user, class_id)
    return attendance_service.get_attendance_for_date(db, class_id, date)

@router.post("/bulk")
def mark_attendance(
    data: Union[AttendanceBulk, list[AttendanceEntry]],
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    """Accept both {entries: [...]} and [...] formats."""
    if isinstance(data, list):
        entries = data
    else:
        entries = data.entries
    if current_user.role == "teacher":
        class_ids = {entry.class_id for entry in entries}
        for class_id in class_ids:
            ensure_class_teacher_access(current_user, class_id)
        for entry in entries:
            student = db.query(Student).filter_by(id=entry.student_id).first()
            if not student:
                raise HTTPException(status_code=404, detail=f"Student {entry.student_id} not found")
            if student.class_id != entry.class_id:
                raise HTTPException(
                    status_code=422,
                    detail=f"Student {entry.student_id} does not belong to class {entry.class_id}",
                )
    try:
        return attendance_service.mark_attendance_bulk(db, entries)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

@router.get("/monthly")
def get_monthly_summary(
    class_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    student_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher", "student", "parent")),
):
    if current_user.role in ("admin", "teacher"):
        ensure_class_access(current_user, class_id)
        return attendance_service.get_monthly_summary(db, class_id, year, month)

    allowed_ids = (
        [current_user.linked_student_id]
        if current_user.role == "student" and current_user.linked_student_id is not None
        else current_user.linked_student_ids
    )
    target_id = student_id or (allowed_ids[0] if allowed_ids else None)
    if target_id is None or target_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="You do not have access to this student")
    student = db.query(Student).filter_by(id=target_id).first()
    cls = db.query(Class).filter_by(id=class_id).first()
    enrolled = (
        db.query(Enrollment.id)
        .filter_by(student_id=target_id, class_id=class_id, academic_year_id=cls.academic_year_id)
        .first()
        if cls
        else None
    )
    if not student or (student.class_id != class_id and not enrolled):
        raise HTTPException(status_code=404, detail="Student not found")
    summary = attendance_service.get_monthly_summary(db, class_id, year, month)
    return [row for row in summary if row["student_id"] == target_id]

@router.get("/dashboard-stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    cache_key = "dashboard_stats:admin"
    cached = response_cache.get(cache_key)
    if cached is not None:
        return cached
    data = attendance_service.get_dashboard_stats(db)
    response_cache.set(cache_key, data, settings.RESPONSE_CACHE_TTL_SECONDS)
    return data
