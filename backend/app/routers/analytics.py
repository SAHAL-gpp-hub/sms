from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import Attendance, Class, Exam, FeePayment, StudentFee
from app.routers.auth import CurrentUser, require_role
from app.services import attendance_service, marks_service


router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


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
    exam_id: int = Query(...),
    academic_year_id: int = Query(...),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    classes = db.query(Class).filter(Class.academic_year_id == academic_year_id).order_by(Class.name, Class.division).all()
    out = []
    for cls in classes:
        rows = marks_service.get_class_results(db, exam_id=exam_id, class_id=cls.id)
        if not rows:
            continue
        avg_percentage = sum(float(item["percentage"]) for item in rows) / len(rows)
        out.append(
            {
                "class_id": cls.id,
                "class_name": f"{cls.name}{f'-{cls.division}' if cls.division else ''}",
                "avg_percentage": round(avg_percentage, 2),
            }
        )
    return out


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
    class_id: Optional[int] = Query(None),
    months: int = Query(3, ge=1, le=12),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    present_case = case((Attendance.status == "P", 1), (Attendance.status == "L", 1), else_=0)
    trend_rows = (
        db.query(
            Attendance.date.label("date"),
            func.count(Attendance.id).label("total"),
            func.sum(present_case).label("present"),
        )
        .filter(Attendance.date >= func.current_date() - func.make_interval(0, months))
        .filter(Attendance.class_id == class_id if class_id else True)
        .group_by(Attendance.date)
        .order_by(Attendance.date)
        .all()
    )
    return [
        {
            "date": row.date.isoformat(),
            "attendance_pct": round((float(row.present or 0) / float(row.total or 1)) * 100, 2),
        }
        for row in trend_rows
    ]


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
    classes = db.query(Class).order_by(Class.id)
    if academic_year_id:
        classes = classes.filter(Class.academic_year_id == academic_year_id)
    rows = []
    for cls in classes.all():
        summary = attendance_service.get_monthly_summary(db, cls.id, today.year, today.month)
        for item in summary:
            if float(item.get("percentage", 0)) < threshold:
                rows.append(
                    {
                        "student_id": item["student_id"],
                        "student_name": item["student_name"],
                        "class_id": cls.id,
                        "class_name": f"{cls.name}{f'-{cls.division}' if cls.division else ''}",
                        "attendance_pct": float(item.get("percentage", 0)),
                    }
                )
    rows.sort(key=lambda item: item["attendance_pct"])
    return {"threshold": threshold, "count": len(rows), "students": rows}
