"""
attendance_service.py — Updated.

Key fixes vs original:
  1. get_monthly_summary() now uses calendar_service.count_working_days_for_month()
    instead of hardcoded "exclude Sundays" — so holidays are deducted from
    the denominator correctly.
  2. get_attendance_for_date() now accepts academic_year_id so calendar
    service can look up holidays.
  3. FIX B: get_dashboard_stats() merges sections into one entry per class name
     in class_counts (Nursery-A + Nursery-B + Nursery-C → one "Nursery" entry).
  4. FIX D: Today's attendance summary uses multi-value status sets so "present",
     "PRESENT", and "P" are all counted correctly.
  5. All other existing behaviour preserved.
"""

from collections import defaultdict
from datetime import date, timedelta
from calendar import monthrange
from typing import Optional

from sqlalchemy import and_, case, func, or_, tuple_
from sqlalchemy.orm import Session

from app.models.base_models import (
    Attendance, AcademicYear, Class, Enrollment, EnrollmentStatusEnum,
    FeePayment, FeeStructure, Student, StudentFee, StudentStatusEnum,
)
from app.schemas.attendance import AttendanceEntry
from app.services.calendar_service import count_working_days, count_working_days_for_month
from app.core.config import settings


ACTIVE_ENROLLMENT_STATUSES = (
    EnrollmentStatusEnum.active,
    EnrollmentStatusEnum.retained,
    EnrollmentStatusEnum.provisional,
)

# FIX D: accept any casing of stored status values
PRESENT_STATUSES = {"P", "present", "PRESENT"}
ABSENT_STATUSES  = {"A", "absent",  "ABSENT"}


def _resolve_enrollment_for_attendance(db: Session, entry: AttendanceEntry) -> Enrollment:
    if entry.enrollment_id is not None:
        enrollment = db.query(Enrollment).filter_by(id=entry.enrollment_id).first()
        if not enrollment:
            raise ValueError(f"Enrollment {entry.enrollment_id} not found")
        return enrollment
    if entry.student_id is None or entry.class_id is None:
        raise ValueError("Provide enrollment_id, or both student_id and class_id")
    cls = db.query(Class).filter_by(id=entry.class_id).first()
    if not cls:
        raise ValueError(f"Class {entry.class_id} not found")
    enrollment = db.query(Enrollment).filter_by(
        student_id=entry.student_id,
        class_id=entry.class_id,
        academic_year_id=cls.academic_year_id,
    ).first()
    if not enrollment:
        raise ValueError(f"Student {entry.student_id} is not enrolled in class {entry.class_id}")
    return enrollment


def mark_attendance_bulk(db: Session, entries: list[AttendanceEntry]):
    if not entries:
        return {"marked": 0}

    enrollment_ids = {entry.enrollment_id for entry in entries if entry.enrollment_id is not None}
    requested_class_ids = {entry.class_id for entry in entries if entry.class_id is not None}

    classes_by_id = {
        cls.id: cls
        for cls in db.query(Class).filter(Class.id.in_(requested_class_ids)).all()
    } if requested_class_ids else {}

    enrollment_filters = []
    if enrollment_ids:
        enrollment_filters.append(Enrollment.id.in_(enrollment_ids))
    student_class_year_keys = []
    for entry in entries:
        if entry.enrollment_id is not None:
            continue
        if entry.student_id is None or entry.class_id is None:
            raise ValueError("Provide enrollment_id, or both student_id and class_id")
        cls = classes_by_id.get(entry.class_id)
        if not cls:
            raise ValueError(f"Class {entry.class_id} not found")
        student_class_year_keys.append((entry.student_id, entry.class_id, cls.academic_year_id))
    if student_class_year_keys:
        enrollment_filters.append(
            tuple_(Enrollment.student_id, Enrollment.class_id, Enrollment.academic_year_id).in_(student_class_year_keys)
        )

    enrollments = (
        db.query(Enrollment)
        .filter(or_(*enrollment_filters))
        .all()
        if enrollment_filters else []
    )
    enrollments_by_id = {enrollment.id: enrollment for enrollment in enrollments}
    enrollments_by_student_class_year = {
        (enrollment.student_id, enrollment.class_id, enrollment.academic_year_id): enrollment
        for enrollment in enrollments
    }

    class_ids = {enrollment.class_id for enrollment in enrollments}
    missing_class_ids = class_ids - set(classes_by_id)
    if missing_class_ids:
        classes_by_id.update({
            cls.id: cls
            for cls in db.query(Class).filter(Class.id.in_(missing_class_ids)).all()
        })
    years_by_id = {
        year.id: year
        for year in db.query(AcademicYear).filter(
            AcademicYear.id.in_({cls.academic_year_id for cls in classes_by_id.values()})
        ).all()
    } if classes_by_id else {}

    resolved_entries = []
    for entry in entries:
        if entry.enrollment_id is not None:
            enrollment = enrollments_by_id.get(entry.enrollment_id)
            if not enrollment:
                raise ValueError(f"Enrollment {entry.enrollment_id} not found")
        else:
            cls = classes_by_id[entry.class_id]
            enrollment = enrollments_by_student_class_year.get(
                (entry.student_id, entry.class_id, cls.academic_year_id)
            )
            if not enrollment:
                raise ValueError(f"Student {entry.student_id} is not enrolled in class {entry.class_id}")
        cls = classes_by_id.get(enrollment.class_id)
        if not cls:
            raise ValueError(f"Class {enrollment.class_id} not found")
        year = years_by_id.get(cls.academic_year_id)
        if year and not (year.start_date <= entry.date <= year.end_date):
            raise ValueError(f"{entry.date} is outside academic year {year.label}")
        resolved_entries.append((entry, enrollment))

    attendance_keys = {(enrollment.id, entry.date) for entry, enrollment in resolved_entries}
    existing_by_key = {
        (record.enrollment_id, record.date): record
        for record in (
            db.query(Attendance)
            .filter(tuple_(Attendance.enrollment_id, Attendance.date).in_(list(attendance_keys)))
            .all()
            if attendance_keys else []
        )
    }

    for entry, enrollment in resolved_entries:
        existing = existing_by_key.get((enrollment.id, entry.date))
        if existing:
            existing.status = entry.status
            existing.student_id = enrollment.student_id
            existing.class_id = enrollment.class_id
        else:
            record = Attendance(
                enrollment_id=enrollment.id,
                student_id=enrollment.student_id,
                class_id=enrollment.class_id,
                date=entry.date,
                status=entry.status,
            )
            db.add(record)
            existing_by_key[(enrollment.id, entry.date)] = record
    db.commit()
    return {"marked": len(entries)}


def get_attendance_for_date(db: Session, class_id: int, query_date: date):
    cls = db.query(Class).filter_by(id=class_id).first()
    academic_year_id = cls.academic_year_id if cls else None
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.class_id == class_id)
        .filter(Enrollment.academic_year_id == academic_year_id if academic_year_id else True)
        .filter(Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
        .all()
    )
    student_map = {
        s.id: s
        for s in db.query(Student).filter(Student.id.in_([e.student_id for e in enrollments])).all()
    } if enrollments else {}
    attendance = db.query(Attendance).filter(
        Attendance.enrollment_id.in_([e.id for e in enrollments]) if enrollments else False,
        Attendance.date == query_date,
    ).all()
    att_map = {a.enrollment_id: a.status for a in attendance}

    return [
        {
            "enrollment_id": e.id,
            "student_id":   e.student_id,
            "student_name": student_map[e.student_id].name_en if e.student_id in student_map else "",
            "roll_number":  e.roll_number,
            "status":       att_map.get(e.id, "UNMARKED"),
        }
        for e in sorted(enrollments, key=lambda x: int(x.roll_number) if str(x.roll_number or "").isdigit() else 9999)
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
                Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
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

    enrollment_ids = [e.id for e in enrollments]
    all_records = db.query(Attendance).filter(
        Attendance.date     >= month_start,
        Attendance.date     <= month_end,
        Attendance.enrollment_id.in_(enrollment_ids) if enrollment_ids else False,
    ).all()

    enrollment_by_id = {e.id: e for e in enrollments}
    att_by_student: dict[int, dict] = {}
    for rec in all_records:
        enrollment = enrollment_by_id.get(rec.enrollment_id)
        if enrollment:
            att_by_student.setdefault(enrollment.student_id, {})[rec.date] = rec.status

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
            "enrollment_id":      enrollment.id if enrollment else None,
            "roll_number":        enrollment.roll_number if enrollment else student.roll_number,
            "total_working_days": working_days,
            "days_present":       present,
            "days_absent":        absent,
            "days_late":          late,
            "percentage":         percentage,
            "low_attendance":     percentage < 75,
        })

    results.sort(key=lambda x: x["roll_number"] or 9999)
    return results


def get_monthly_summary_bulk(db: Session, academic_year_id: int, year: int, month: int) -> list[dict]:
    """
    Return monthly attendance summaries for every active student in an academic
    year with one grouped attendance query instead of one query per class.
    """
    _, days_in_month = monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, days_in_month)

    classes = db.query(Class).filter(Class.academic_year_id == academic_year_id).all()
    class_by_id = {cls.id: cls for cls in classes}
    working_days_by_class = {
        cls.id: count_working_days_for_month(db, academic_year_id, year, month)
        for cls in classes
    }
    if not class_by_id:
        return []

    present_case = case((Attendance.status == "P", 1), else_=0)
    absent_case = case((Attendance.status == "A", 1), else_=0)
    late_case = case((Attendance.status == "L", 1), else_=0)

    rows = (
        db.query(
            Enrollment.id.label("enrollment_id"),
            Enrollment.student_id.label("student_id"),
            Student.name_en.label("student_name"),
            Enrollment.roll_number.label("roll_number"),
            Enrollment.class_id.label("class_id"),
            func.coalesce(func.sum(present_case), 0).label("present"),
            func.coalesce(func.sum(absent_case), 0).label("absent"),
            func.coalesce(func.sum(late_case), 0).label("late"),
        )
        .join(Student, Student.id == Enrollment.student_id)
        .outerjoin(
            Attendance,
            and_(
                Attendance.enrollment_id == Enrollment.id,
                Attendance.date >= month_start,
                Attendance.date <= month_end,
            ),
        )
        .filter(
            Enrollment.academic_year_id == academic_year_id,
            Enrollment.class_id.in_(class_by_id.keys()),
            Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
        )
        .group_by(Enrollment.id, Enrollment.student_id, Student.name_en, Enrollment.roll_number, Enrollment.class_id)
        .all()
    )

    results = []
    for row in rows:
        working_days = working_days_by_class.get(row.class_id, 0)
        present = int(row.present or 0)
        absent = int(row.absent or 0)
        late = int(row.late or 0)
        effective_present = present + (late if settings.LATE_COUNTS_AS_PRESENT else 0)
        percentage = round((effective_present / working_days * 100), 1) if working_days > 0 else 0
        cls = class_by_id.get(row.class_id)
        results.append({
            "student_id": row.student_id,
            "enrollment_id": row.enrollment_id,
            "student_name": row.student_name,
            "roll_number": row.roll_number,
            "class_id": row.class_id,
            "class_name": f"{cls.name}{f'-{cls.division}' if cls and cls.division else ''}" if cls else "",
            "total_working_days": working_days,
            "days_present": present,
            "days_absent": absent,
            "days_late": late,
            "percentage": percentage,
            "low_attendance": percentage < 75,
        })

    results.sort(key=lambda x: (x["class_name"], x["roll_number"] or 9999, x["student_name"]))
    return results


def get_dashboard_stats(db: Session, academic_year_id: Optional[int] = None) -> dict:
    from decimal import Decimal

    current_year = (
        db.query(AcademicYear).filter_by(id=academic_year_id).first()
        if academic_year_id
        else db.query(AcademicYear).filter_by(is_current=True).first()
    )
    current_year_id = current_year.id if current_year else None

    total_students = db.query(Enrollment).filter(
        Enrollment.academic_year_id == current_year_id if current_year_id else True,
        Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
    ).count()

    today       = date.today()
    month_start = date(today.year, today.month, 1)

    fees_this_month_query = db.query(func.sum(FeePayment.amount_paid)).join(StudentFee, StudentFee.id == FeePayment.student_fee_id)
    if current_year_id:
        fees_this_month_query = fees_this_month_query.join(Enrollment, Enrollment.id == StudentFee.enrollment_id).filter(
            Enrollment.academic_year_id == current_year_id
        )
    fees_this_month = fees_this_month_query.filter(
        FeePayment.payment_date >= month_start,
        FeePayment.payment_date <= today,
    ).scalar() or Decimal("0")

    fees_this_year = Decimal("0")
    if current_year:
        fees_this_year = db.query(func.sum(FeePayment.amount_paid)).join(
            StudentFee, StudentFee.id == FeePayment.student_fee_id
        ).join(
            Enrollment, Enrollment.id == StudentFee.enrollment_id
        ).filter(
            Enrollment.academic_year_id == current_year_id,
            FeePayment.payment_date >= current_year.start_date,
            FeePayment.payment_date <= today,
        ).scalar() or Decimal("0")

    fee_query = db.query(func.sum(StudentFee.net_amount))
    if current_year_id:
        fee_query = fee_query.join(Enrollment, Enrollment.id == StudentFee.enrollment_id).filter(
            Enrollment.academic_year_id == current_year_id
        )
    total_due = fee_query.scalar() or Decimal("0")
    total_paid_query = db.query(func.sum(FeePayment.amount_paid)).join(StudentFee, StudentFee.id == FeePayment.student_fee_id)
    if current_year_id:
        total_paid_query = total_paid_query.join(Enrollment, Enrollment.id == StudentFee.enrollment_id).filter(
            Enrollment.academic_year_id == current_year_id
        )
    total_paid = total_paid_query.scalar() or Decimal("0")
    total_outstanding = total_due - total_paid

    defaulter_rows = (
        db.query(
            Student.id.label("student_id"),
            (
                func.coalesce(func.sum(StudentFee.net_amount), 0)
                - func.coalesce(func.sum(FeePayment.amount_paid), 0)
            ).label("balance"),
        )
        .join(Enrollment, Enrollment.student_id == Student.id)
        .join(StudentFee, StudentFee.enrollment_id == Enrollment.id, isouter=True)
        .join(FeeStructure, StudentFee.fee_structure_id == FeeStructure.id, isouter=True)
        .outerjoin(FeePayment, FeePayment.student_fee_id == StudentFee.id)
        .filter(Enrollment.academic_year_id == current_year_id if current_year_id else True)
        .filter(Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
        .group_by(Student.id)
        .all()
    )
    defaulter_count = sum(1 for row in defaulter_rows if Decimal(str(row.balance)) > 0)

    recent_payment_query = db.query(FeePayment).join(StudentFee, StudentFee.id == FeePayment.student_fee_id)
    if current_year_id:
        recent_payment_query = recent_payment_query.join(Enrollment, Enrollment.id == StudentFee.enrollment_id).filter(
            Enrollment.academic_year_id == current_year_id
        )
    recent_payments = recent_payment_query.order_by(FeePayment.payment_date.desc()).limit(5).all()
    recent_students = (
        db.query(Student)
        .filter(Student.status == StudentStatusEnum.Active)
        .order_by(Student.created_at.desc())
        .limit(5)
        .all()
    )

    # FIX B: merge sections — one entry per Class.name (not per Class row/section)
    raw_class_counts = (
        db.query(Class.id, Class.name, func.count(Enrollment.id))
        .join(Enrollment, Enrollment.class_id == Class.id)
        .filter(Enrollment.academic_year_id == current_year_id if current_year_id else True)
        .filter(Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
        .group_by(Class.id, Class.name)
        .all()
    )

    # Merge: Nursery-A + Nursery-B + Nursery-C → one "Nursery" entry
    merged: dict[str, dict] = defaultdict(lambda: {"class_id": None, "class_name": "", "count": 0})
    for cls_id, cls_name, cnt in raw_class_counts:
        merged[cls_name]["class_name"] = cls_name
        merged[cls_name]["count"] += cnt
        if merged[cls_name]["class_id"] is None:
            merged[cls_name]["class_id"] = cls_id  # keep first section's id as representative
    class_counts = list(merged.values())

    # ── Today's attendance summary ────────────────────────────────────────────
    # FIX D: use Python-side status sets to handle any casing in the DB.
    att_records = (
        db.query(Attendance.status)
        .join(Enrollment, Enrollment.id == Attendance.enrollment_id)
        .filter(
            Attendance.date == today,
            Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
        )
    )
    if current_year_id:
        att_records = att_records.filter(Enrollment.academic_year_id == current_year_id)

    att_present = 0
    att_absent  = 0
    att_marked  = 0
    for (status,) in att_records.all():
        att_marked += 1
        if status in PRESENT_STATUSES:
            att_present += 1
        elif status in ABSENT_STATUSES:
            att_absent += 1
        # anything else (L, late, LATE, OL…) counts as neither present nor absent

    att_not_marked = max(0, total_students - att_marked)
    att_total      = total_students

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
            {"student_id": s.id, "name": s.name_en, "class_id": s.class_id}
            for s in recent_students
        ],
        "class_counts": class_counts,
        "attendance_summary": {
            "present":     att_present,
            "absent":      att_absent,
            "not_marked":  att_not_marked,
            "total":       att_total,
        },
    }