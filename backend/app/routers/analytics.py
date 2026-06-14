from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import AcademicYear, Attendance, Class, Exam, FeePayment, StudentFee
from app.routers.auth import CurrentUser, require_role
from app.services import analytics_service, attendance_service, marks_service


router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/summary")
def analytics_summary(
    academic_year_id: int = Query(...),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    totals = (
        db.query(
            func.coalesce(func.sum(StudentFee.net_amount), 0).label("net_due"),
            func.coalesce(func.sum(FeePayment.amount_paid), 0).label("collected"),
        )
        .outerjoin(FeePayment, FeePayment.student_fee_id == StudentFee.id)
        .filter(StudentFee.academic_year_id == academic_year_id)
        .first()
    )
    net_due = float(totals.net_due or 0)
    collected = float(totals.collected or 0)
    outstanding = max(net_due - collected, 0)
    collection_rate = (collected / net_due * 100) if net_due > 0 else 0.0

    today = date.today()
    risk_rows = attendance_service.get_monthly_summary_bulk(db, academic_year_id, today.year, today.month)
    at_risk_count = sum(1 for row in risk_rows if float(row.get("percentage", 0)) < 75)

    return {
        "collection_rate": round(collection_rate, 2),
        "total_collected": round(collected, 2),
        "outstanding": round(outstanding, 2),
        "at_risk_count": at_risk_count,
    }


@router.get("/fee-collection")
def fee_collection_trend(
    academic_year_id: int = Query(...),
    months: int = Query(12, ge=1, le=36),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    month_key = func.date_trunc("month", FeePayment.payment_date)
    rows = (
        db.query(
            month_key.label("month"),
            func.coalesce(func.sum(FeePayment.amount_paid), 0).label("collected"),
        )
        .join(StudentFee, FeePayment.student_fee_id == StudentFee.id)
        .filter(StudentFee.academic_year_id == academic_year_id)
        .filter(FeePayment.payment_date >= func.current_date() - func.make_interval(0, months))
        .group_by(month_key)
        .order_by(month_key)
        .all()
    )

    totals = (
        db.query(
            func.coalesce(func.sum(StudentFee.net_amount), 0).label("net_due"),
            func.coalesce(func.sum(FeePayment.amount_paid), 0).label("collected"),
        )
        .outerjoin(FeePayment, FeePayment.student_fee_id == StudentFee.id)
        .filter(StudentFee.academic_year_id == academic_year_id)
        .first()
    )
    net_due = float(totals.net_due or 0)
    collected = float(totals.collected or 0)
    outstanding = max(net_due - collected, 0)
    collection_rate = (collected / net_due * 100) if net_due > 0 else 0.0

    return {
        "summary": {
            "collection_rate": round(collection_rate, 2),
            "total_collected": round(collected, 2),
            "outstanding": round(outstanding, 2),
        },
        "trend": [
            {
                "month": row.month.strftime("%b %Y"),
                "collected": float(row.collected or 0),
            }
            for row in rows
        ],
    }


@router.get("/class-performance")
def class_performance(
    academic_year_id: int = Query(...),
    exam_name: str = Query(...),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Returns {classes, school_average, top_class} for the given exam name.
    Each class entry has {class_name, avg_percentage}.
    Sections (e.g. Nursery-A/B/C) are merged into one entry per class name.
    Only classes with at least one student with marks entered are included.
    """
    return analytics_service.class_performance(db, academic_year_id, exam_name)


@router.get("/grade-distribution")
def grade_distribution(
    exam_id: int = Query(...),
    academic_year_id: int = Query(...),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    buckets: dict[str, int] = {}
    classes = db.query(Class.id).filter(Class.academic_year_id == academic_year_id).all()
    for (class_id,) in classes:
        for row in marks_service.get_class_results(db, exam_id=exam_id, class_id=class_id):
            grade = row.get("grade") or "NA"
            buckets[grade] = buckets.get(grade, 0) + 1
    return [{"grade": grade, "count": count} for grade, count in sorted(buckets.items())]


@router.get("/attendance-trends")
def attendance_trends(
    # FIX C: filter by class_name (covers all sections) instead of class_id (single section)
    class_name: Optional[str] = Query(None),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Returns daily attendance % for the last 7 days anchored to today.
    Filters by class name so all sections of a class are included.
    attendance_pct is null when no attendance was marked that day.
    """
    return analytics_service.attendance_trends(db, class_name, days=7)


@router.get("/top-students")
def top_students(
    exam_id: int = Query(...),
    limit: int = Query(10, ge=1, le=50),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        return []
    classes = db.query(Class.id).filter(Class.academic_year_id == exam.academic_year_id).all()
    all_rows = []
    for (class_ref,) in classes:
        all_rows.extend(marks_service.get_class_results(db, exam_id=exam_id, class_id=class_ref))
    all_rows.sort(key=lambda item: (item.get("total_marks") or 0), reverse=True)
    return [
        {
            "student_id": row["student_id"],
            "student_name": row["student_name"],
            "class_rank": row["class_rank"],
            "total_marks": row["total_marks"],
            "percentage": row["percentage"],
            "grade": row["grade"],
        }
        for row in all_rows[:limit]
    ]


@router.get("/at-risk-attendance")
def at_risk_students(
    threshold: float = Query(75.0, ge=0, le=100),
    academic_year_id: Optional[int] = Query(None),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    today = date.today()
    if academic_year_id:
        summaries = attendance_service.get_monthly_summary_bulk(db, academic_year_id, today.year, today.month)
    else:
        current_year = db.query(AcademicYear).filter_by(is_current=True).first()
        summaries = attendance_service.get_monthly_summary_bulk(db, current_year.id, today.year, today.month) if current_year else []
    rows = []
    for item in summaries:
        if float(item.get("percentage", 0)) < threshold:
            rows.append(
                {
                    "student_id": item["student_id"],
                    "student_name": item["student_name"],
                    "class_id": item["class_id"],
                    "class_name": item["class_name"],
                    "attendance_pct": float(item.get("percentage", 0)),
                }
            )
    rows.sort(key=lambda item: item["attendance_pct"])
    return {"threshold": threshold, "count": len(rows), "students": rows}