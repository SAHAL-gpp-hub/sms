from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models.base_models import Attendance, Student, Class
from app.schemas.attendance import AttendanceEntry
from datetime import date, timedelta
from calendar import monthrange

def mark_attendance_bulk(db: Session, entries: list[AttendanceEntry]):
    for entry in entries:
        existing = db.query(Attendance).filter_by(
            student_id=entry.student_id,
            class_id=entry.class_id,
            date=entry.date
        ).first()
        if existing:
            existing.status = entry.status
        else:
            db.add(Attendance(
                student_id=entry.student_id,
                class_id=entry.class_id,
                date=entry.date,
                status=entry.status
            ))
    db.commit()
    return {"marked": len(entries)}

def get_attendance_for_date(db: Session, class_id: int, date: date):
    students = db.query(Student).filter_by(
        class_id=class_id
    ).filter(Student.status == "Active").all()

    attendance = db.query(Attendance).filter_by(
        class_id=class_id, date=date
    ).all()

    att_map = {a.student_id: a.status for a in attendance}

    return [
        {
            "student_id": s.id,
            "student_name": s.name_en,
            "roll_number": s.roll_number,
            "status": att_map.get(s.id, "P")  # default Present
        }
        for s in sorted(students, key=lambda x: x.roll_number or 9999)
    ]

def get_monthly_summary(db: Session, class_id: int, year: int, month: int):
    students = db.query(Student).filter_by(
        class_id=class_id
    ).filter(Student.status == "Active").all()

    _, days_in_month = monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, days_in_month)

    # Count working days (Mon-Sat, excluding Sun)
    working_days = sum(
        1 for d in range(days_in_month)
        if date(year, month, d + 1).weekday() != 6  # not Sunday
    )

    # STEP 3.2 FIX: Single bulk query replaces N+1 per-student loop.
    # Previously each student triggered one SELECT; now one query fetches all
    # attendance records for the class/month and we aggregate in Python.
    all_records = db.query(Attendance).filter(
        Attendance.class_id == class_id,
        Attendance.date >= month_start,
        Attendance.date <= month_end,
    ).all()

    # Build a map: {student_id: {date: status}}
    att_by_student: dict[int, dict] = {}
    for rec in all_records:
        att_by_student.setdefault(rec.student_id, {})[rec.date] = rec.status

    results = []
    for student in students:
        status_map = att_by_student.get(student.id, {})
        present = sum(1 for s in status_map.values() if s == "P")
        absent  = sum(1 for s in status_map.values() if s == "A")
        late    = sum(1 for s in status_map.values() if s == "L")
        percentage = round((present / working_days * 100), 1) if working_days > 0 else 0

        results.append({
            "student_id": student.id,
            "student_name": student.name_en,
            "roll_number": student.roll_number,
            "total_working_days": working_days,
            "days_present": present,
            "days_absent": absent,
            "days_late": late,
            "percentage": percentage,
            "low_attendance": percentage < 75,
        })

    results.sort(key=lambda x: x["roll_number"] or 9999)
    return results

def get_dashboard_stats(db: Session):
    from app.models.base_models import (
        Student, FeePayment, StudentFee, FeeStructure, AcademicYear
    )
    from decimal import Decimal
    from datetime import date
    from sqlalchemy.orm import joinedload

    # Total active students
    total_students = db.query(Student).filter_by(status="Active").count()

    # Current academic year
    current_year = db.query(AcademicYear).filter_by(is_current=True).first()

    # Fees collected this month
    today = date.today()
    month_start = date(today.year, today.month, 1)
    fees_this_month = db.query(func.sum(FeePayment.amount_paid)).filter(
        FeePayment.payment_date >= month_start,
        FeePayment.payment_date <= today
    ).scalar() or Decimal("0")

    # Total fees collected this year
    if current_year:
        fees_this_year = db.query(func.sum(FeePayment.amount_paid)).filter(
            FeePayment.payment_date >= current_year.start_date,
            FeePayment.payment_date <= today
        ).scalar() or Decimal("0")
    else:
        fees_this_year = Decimal("0")

    # Total outstanding
    total_due = db.query(func.sum(StudentFee.net_amount)).scalar() or Decimal("0")
    total_paid = db.query(func.sum(FeePayment.amount_paid)).scalar() or Decimal("0")
    total_outstanding = total_due - total_paid

    # Defaulters count
    from app.services.fee_service import get_defaulters
    defaulters = get_defaulters(db)
    defaulter_count = len(defaulters)

    # Recent payments (last 5)
    recent_payments = db.query(FeePayment).order_by(
        FeePayment.payment_date.desc()
    ).limit(5).all()

    # Recent admissions (last 5)
    recent_students = db.query(Student).filter_by(
        status="Active"
    ).order_by(Student.created_at.desc()).limit(5).all()

    # Class-wise count
    class_counts = db.query(
        Class.name, func.count(Student.id)
    ).join(Student, Student.class_id == Class.id).filter(
        Student.status == "Active"
    ).group_by(Class.name).all()

    return {
        "total_students": total_students,
        "fees_this_month": float(fees_this_month),
        "fees_this_year": float(fees_this_year),
        "total_outstanding": float(total_outstanding),
        "defaulter_count": defaulter_count,
        "recent_payments": [
            {
                "receipt_number": p.receipt_number,
                "amount": float(p.amount_paid),
                "date": str(p.payment_date),
                "mode": p.mode
            }
            for p in recent_payments
        ],
        "recent_students": [
            {
                "student_id": s.student_id,
                "name": s.name_en,
                "class_id": s.class_id
            }
            for s in recent_students
        ],
        "class_counts": [
            {"class_name": name, "count": count}
            for name, count in class_counts
        ]
    }