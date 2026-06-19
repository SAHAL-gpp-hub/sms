"""
schemas/attendance.py

Attendance status is strictly binary: "P" (present) or "A" (absent). The
`AttendanceStatus` Literal and the DB CHECK constraint
(ck_attendance_status_present_absent) enforce this end-to-end. Legacy "Late"
and "On-Leave" statuses were removed; any historical rows were converted to
"A" by migration q1a2b3c4d5e6f.
"""

from pydantic import BaseModel
from typing import Literal, Optional
from datetime import date


# The only two attendance statuses the system supports. The same values are
# stored in the attendance.status column and enforced by a DB CHECK constraint
# (see models/base_models.py Attendance).
AttendanceStatus = Literal["P", "A"]


class AttendanceEntry(BaseModel):
    enrollment_id: Optional[int] = None
    student_id: Optional[int] = None
    class_id:   Optional[int] = None
    date:       date
    status:     AttendanceStatus   # P (present) / A (absent) — only these two


class AttendanceBulk(BaseModel):
    entries: list[AttendanceEntry]


class AttendanceOut(BaseModel):
    id:         int
    enrollment_id: int
    student_id: Optional[int]
    class_id:   Optional[int]
    date:       date
    status:     AttendanceStatus
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
    # Canonical name — service must return "percentage" (not "attendance_percentage")
    percentage:         float
    # Canonical name — service must return "low_attendance" (not "is_low_attendance")
    low_attendance:     bool
