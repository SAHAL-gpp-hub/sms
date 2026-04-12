"""
schemas/attendance.py

BUG 1 FIX:
  MonthlyAttendanceSummary previously declared fields named:
    percentage:      float    ← correct schema name
    low_attendance:  bool     ← correct schema name

  But attendance_service.get_monthly_summary() returned a dict with keys:
    "attendance_percentage"   ← wrong, mismatched
    "is_low_attendance"       ← wrong, mismatched

  Because the router returns the raw service dict (not a validated Pydantic
  response), the mismatch was silent — the frontend and PDF templates received
  None for both fields on every call.

  Fix is in attendance_service.py (keys corrected to "percentage" and
  "low_attendance").  This schema file is the authoritative contract; no
  changes needed here, but the field names are documented clearly to prevent
  future drift.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import date


class AttendanceEntry(BaseModel):
    student_id: int
    class_id:   int
    date:       date
    status:     str   # P / A / L / OL


class AttendanceBulk(BaseModel):
    entries: list[AttendanceEntry]


class AttendanceOut(BaseModel):
    id:         int
    student_id: int
    class_id:   int
    date:       date
    status:     str
    model_config = {"from_attributes": True}


class MonthlyAttendanceSummary(BaseModel):
    """
    Contract for the monthly summary endpoint.
    Field names here MUST match the dict keys returned by
    attendance_service.get_monthly_summary():
      "percentage"     → this field
      "low_attendance" → this field
    Any rename in the service must be reflected here and vice-versa.
    """
    student_id:         int
    student_name:       str
    roll_number:        Optional[int]
    total_working_days: int
    days_present:       int
    days_absent:        int
    days_late:          int
    # Canonical name — service must return "percentage" (not "attendance_percentage")
    percentage:         float
    # Canonical name — service must return "low_attendance" (not "is_low_attendance")
    low_attendance:     bool
