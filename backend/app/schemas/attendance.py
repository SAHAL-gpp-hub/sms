from pydantic import BaseModel
from typing import Optional
from datetime import date

class AttendanceEntry(BaseModel):
    student_id: int
    class_id: int
    date: date
    status: str  # P / A / L / OL

class AttendanceBulk(BaseModel):
    entries: list[AttendanceEntry]

class AttendanceOut(BaseModel):
    id: int
    student_id: int
    class_id: int
    date: date
    status: str
    model_config = {"from_attributes": True}

class MonthlyAttendanceSummary(BaseModel):
    student_id: int
    student_name: str
    roll_number: Optional[int]
    total_working_days: int
    days_present: int
    days_absent: int
    days_late: int
    percentage: float
    low_attendance: bool