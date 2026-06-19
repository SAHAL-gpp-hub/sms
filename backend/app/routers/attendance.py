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
        # C4 fix: previously fired one Enrollment query per entry (twice — once
        # for class-id resolution, once for the body). Batch-load everything
        # needed for access-control up-front in two queries total.
        enrollment_ids = [e.enrollment_id for e in entries if e.enrollment_id is not None]
        enrollments_by_id: dict[int, Enrollment] = {}
        if enrollment_ids:
            enrollments_by_id = {
                en.id: en
                for en in db.query(Enrollment).filter(Enrollment.id.in_(enrollment_ids)).all()
            }

        class_ids_to_lookup = [e.class_id for e in entries if e.class_id is not None and e.enrollment_id is None]
        classes_by_id: dict[int, Class] = {}
        if class_ids_to_lookup:
            classes_by_id = {
                c.id: c
                for c in db.query(Class).filter(Class.id.in_(set(class_ids_to_lookup))).all()
            }

        # Resolve the class_id set for teacher access checks (one pass, no queries).
        resolved_class_ids: set = set()
        for entry in entries:
            if entry.class_id is not None:
                resolved_class_ids.add(entry.class_id)
            elif entry.enrollment_id is not None:
                enrollment = enrollments_by_id.get(entry.enrollment_id)
                if not enrollment:
                    raise HTTPException(status_code=404, detail=f"Enrollment {entry.enrollment_id} not found")
                resolved_class_ids.add(enrollment.class_id)
        for class_id in resolved_class_ids:
            ensure_class_teacher_access(current_user, class_id)

        # Validate each entry resolves to an enrollment (using the pre-fetched maps).
        for entry in entries:
            if entry.enrollment_id is not None:
                enrollment = enrollments_by_id.get(entry.enrollment_id)
            else:
                cls = classes_by_id.get(entry.class_id) if entry.class_id is not None else None
                # No bulk map for (student_id, class_id) pairs: these legacy
                # entries still need a lookup, but only for entries that don't
                # carry an enrollment_id (typically a small minority).
                enrollment = db.query(Enrollment).filter_by(
                    student_id=entry.student_id,
                    class_id=entry.class_id,
                    academic_year_id=cls.academic_year_id if cls else None,
                ).first()
            if not enrollment:
                raise HTTPException(
                    status_code=422,
                    detail="Student is not enrolled in this class/year",
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
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    cache_key = f"dashboard_stats:admin:{academic_year_id or 'current'}"
    cached = response_cache.get(cache_key)
    if cached is not None:
        return cached
    data = attendance_service.get_dashboard_stats(db, academic_year_id)
    response_cache.set(cache_key, data, settings.RESPONSE_CACHE_TTL_SECONDS)
    return data
