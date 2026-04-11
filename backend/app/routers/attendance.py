from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional, Union
from pydantic import BaseModel
from app.core.database import get_db
from app.schemas.attendance import AttendanceBulk, AttendanceOut, AttendanceEntry
from app.services import attendance_service

router = APIRouter(prefix="/api/v1/attendance", tags=["Attendance"])

@router.get("/daily")
def get_daily_attendance(
    class_id: int = Query(...),
    date: date = Query(...),
    db: Session = Depends(get_db)
):
    return attendance_service.get_attendance_for_date(db, class_id, date)

@router.post("/bulk")
def mark_attendance(
    data: Union[AttendanceBulk, list[AttendanceEntry]],
    db: Session = Depends(get_db)
):
    """Accept both {entries: [...]} and [...] formats."""
    if isinstance(data, list):
        entries = data
    else:
        entries = data.entries
    return attendance_service.mark_attendance_bulk(db, entries)

@router.get("/monthly")
def get_monthly_summary(
    class_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db)
):
    return attendance_service.get_monthly_summary(db, class_id, year, month)

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    return attendance_service.get_dashboard_stats(db)
