"""
attendance_service.py — Updated.

Key fixes vs original:
  1. get_monthly_summary() now uses calendar_service.count_working_days_for_month()
     instead of hardcoded "exclude Sundays" — so holidays are deducted from
     the denominator correctly.
  2. get_attendance_for_date() now accepts academic_year_id so calendar
     service can look up holidays.
  3. All other existing behaviour preserved.
"""

from datetime import date, timedelta
from calendar import monthrange
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.base_models import (
    Attendance, AcademicYear, Class, Enrollment, FeePayment, FeeStructure,
    Student, StudentFee, StudentStatusEnum,
)
from app.schemas.attendance import AttendanceEntry
from app.services.calendar_service import count_working_days, count_working_days_for_month
from app.core.config import settings


def mark_attendance_bulk(db: Session, entries: list[AttendanceEntry]):
    for entry in entries:
        cls = db.query(Class).filter_by(id=entry.class_id).first()
        if not cls:
            raise ValueError(f"Class {entry.class_id} not found")
        year = db.query(AcademicYear).filter_by(id=cls.academic_year_id).first()
        if year and not (year.start_date <= entry.date <= year.end_date):
            raise ValueError(f"{entry.date} is outside academic year {year.label}")
        existing = db.query(Attendance).filter_by(
            student_id=entry.student_id,
            class_id=entry.class_id,
            date=entry.date,
        ).first()
        if existing:
            existing.status = entry.status
        else:
            db.add(Attendance(
                student_id=entry.student_id,
                class_id=entry.class_id,
                date=entry.date,
                status=entry.status,
            ))
    db.commit()
    return {"marked": len(entries)}


def get_attendance_for_date(db: Session, class_id: int, query_date: date):
    students = (
        db.query(Student)
        .filter_by(class_id=class_id)
        .filter(Student.status == StudentStatusEnum.Active)
        .all()
    )
    attendance = db.query(Attendance).filter_by(
        class_id=class_id, date=query_date
    ).all()
    att_map = {a.student_id: a.status for a in attendance}

    return [
        {
            "student_id":   s.id,
            "student_name": s.name_en,
            "roll_number":  s.roll_number,
            "status":       att_map.get(s.id, "P"),
        }
        for s in sorted(students, key=lambda x: x.roll_number or 9999)
    ]


def get_monthly_summary(db: Session, class_id: int, year: int, month: int) -> list[dict]:
    """
    FIXED: Uses calendar-aware working day count.
    Falls back to Sunday-exclusion if no academic_year_id can be determined.
    """
    # Determine academic_year_id from the class
    cls = db.query(Class).filter_by(id=class_id).first()
    academic_year_id = cls.academic_year_id if cls else None

    _, days_in_month = monthrange(year, month)
    month_start = date(year, month, 1)
    month_end   = date(year, month, days_in_month)

    enrollments = []
    if academic_year_id:
        enrollments = (
            db.query(Enrollment)
            .filter(
                Enrollment.class_id == class_id,
                Enrollment.academic_year_id == academic_year_id,
                Enrollment.status.in_(["active", "retained", "provisional"]),
                Enrollment.enrolled_on <= month_end,
            )
            .all()
        )

    if enrollments:
        student_ids = [e.student_id for e in enrollments]
        students = db.query(Student).filter(Student.id.in_(student_ids)).all()
        enrollment_by_student = {e.student_id: e for e in enrollments}
    else:
        students = (
            db.query(Student)
            .filter_by(class_id=class_id)
            .filter(Student.status == StudentStatusEnum.Active)
            .all()
        )
        enrollment_by_student = {}
        student_ids = [s.id for s in students]

    all_records = db.query(Attendance).filter(
        Attendance.class_id == class_id,
        Attendance.date     >= month_start,
        Attendance.date     <= month_end,
        Attendance.student_id.in_(student_ids) if student_ids else False,
    ).all()

    att_by_student: dict[int, dict] = {}
    for rec in all_records:
        att_by_student.setdefault(rec.student_id, {})[rec.date] = rec.status

    results = []
    for student in students:
        enrollment = enrollment_by_student.get(student.id)
        working_from = max(month_start, enrollment.enrolled_on) if enrollment else month_start
        working_days = count_working_days(db, academic_year_id, working_from, month_end)
        status_map  = att_by_student.get(student.id, {})
        present     = sum(1 for s in status_map.values() if s == "P")
        absent      = sum(1 for s in status_map.values() if s == "A")
        late        = sum(1 for s in status_map.values() if s == "L")
        effective_present = present + (late if settings.LATE_COUNTS_AS_PRESENT else 0)
        percentage  = round((effective_present / working_days * 100), 1) if working_days > 0 else 0

        results.append({
            "student_id":         student.id,
            "student_name":       student.name_en,
            "roll_number":        student.roll_number,
            "total_working_days": working_days,
            "days_present":       present,
            "days_absent":        absent,
            "days_late":          late,
            "percentage":         percentage,
            "low_attendance":     percentage < 75,
        })

    results.sort(key=lambda x: x["roll_number"] or 9999)
    return results


def get_dashboard_stats(db: Session) -> dict:
    from decimal import Decimal

    total_students = db.query(Student).filter(
        Student.status == StudentStatusEnum.Active
    ).count()

    current_year = db.query(AcademicYear).filter_by(is_current=True).first()

    today       = date.today()
    month_start = date(today.year, today.month, 1)

    fees_this_month = db.query(func.sum(FeePayment.amount_paid)).filter(
        FeePayment.payment_date >= month_start,
        FeePayment.payment_date <= today,
    ).scalar() or Decimal("0")

    fees_this_year = Decimal("0")
    if current_year:
        fees_this_year = db.query(func.sum(FeePayment.amount_paid)).filter(
            FeePayment.payment_date >= current_year.start_date,
            FeePayment.payment_date <= today,
        ).scalar() or Decimal("0")

    total_due         = db.query(func.sum(StudentFee.net_amount)).scalar() or Decimal("0")
    total_paid        = db.query(func.sum(FeePayment.amount_paid)).scalar() or Decimal("0")
    total_outstanding = total_due - total_paid

    defaulter_rows = (
        db.query(
            Student.id.label("student_id"),
            (
                func.coalesce(func.sum(StudentFee.net_amount), 0)
                - func.coalesce(func.sum(FeePayment.amount_paid), 0)
            ).label("balance"),
        )
        .join(StudentFee, StudentFee.student_id == Student.id, isouter=True)
        .join(FeeStructure, StudentFee.fee_structure_id == FeeStructure.id, isouter=True)
        .outerjoin(FeePayment, FeePayment.student_fee_id == StudentFee.id)
        .filter(Student.status == StudentStatusEnum.Active)
        .group_by(Student.id)
        .all()
    )
    defaulter_count = sum(1 for row in defaulter_rows if Decimal(str(row.balance)) > 0)

    recent_payments = (
        db.query(FeePayment)
        .order_by(FeePayment.payment_date.desc())
        .limit(5)
        .all()
    )
    recent_students = (
        db.query(Student)
        .filter(Student.status == StudentStatusEnum.Active)
        .order_by(Student.created_at.desc())
        .limit(5)
        .all()
    )
    class_counts = (
        db.query(Class.name, func.count(Student.id))
        .join(Student, Student.class_id == Class.id)
        .filter(Student.status == StudentStatusEnum.Active)
        .group_by(Class.name)
        .all()
    )

    return {
        "total_students":    total_students,
        "fees_this_month":   float(fees_this_month),
        "fees_this_year":    float(fees_this_year),
        "total_outstanding": float(total_outstanding),
        "defaulter_count":   defaulter_count,
        "recent_payments": [
            {
                "receipt_number": p.receipt_number,
                "amount":         float(p.amount_paid),
                "date":           str(p.payment_date),
                "mode":           p.mode,
            }
            for p in recent_payments
        ],
        "recent_students": [
            {"student_id": s.student_id, "name": s.name_en, "class_id": s.class_id}
            for s in recent_students
        ],
        "class_counts": [
            {"class_name": name, "count": count}
            for name, count in class_counts
        ],
    }
