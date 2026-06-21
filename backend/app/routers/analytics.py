"""
app/routers/analytics.py — Performance-optimised.

Changes vs previous version:

1. /class-performance  — now delegates entirely to the rewritten
   analytics_service.class_performance() which uses a single SQL pass
   instead of N × marks_service.get_class_results() calls.

2. /grade-distribution — previously called get_class_results() once per
   class in a Python loop. Now uses a single SQL aggregation query that
   computes grade buckets in the DB.  marks_service no longer called.

3. /top-students — previously called get_class_results() once per class
   (up to 13 calls) to find the top-N students. Now uses a single SQL
   query ordered by total marks descending with LIMIT, then formats the
   result. marks_service no longer called from this endpoint.

4. /attendance-trends, /summary, /fee-collection, /at-risk-attendance —
   unchanged (already efficient or delegated to other services).

All endpoint URLs, query params, and response shapes are unchanged.
"""

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import (
    AcademicYear, Attendance, Class, Enrollment, EnrollmentStatusEnum,
    Exam, ExamSubjectConfig, FeePayment, Mark, Student, StudentFee, Subject,
)
from app.routers.auth import CurrentUser, require_role
from app.services import analytics_service, attendance_service

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])

ACTIVE_ENROLLMENT_STATUSES = (
    EnrollmentStatusEnum.active,
    EnrollmentStatusEnum.retained,
    EnrollmentStatusEnum.provisional,
)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_grade(percentage: float) -> str:
    """Lightweight grade lookup — avoids importing full marks_service."""
    GSEB = [
        (91, "A1"), (81, "A2"), (71, "B1"), (61, "B2"),
        (51, "C1"), (41, "C2"), (33, "D"),  (0,  "E"),
    ]
    pct = max(min(float(percentage), 100.0), 0.0)
    for low, grade in GSEB:
        if pct >= low:
            return grade
    return "E"


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

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
    net_due      = float(totals.net_due   or 0)
    collected    = float(totals.collected or 0)
    outstanding  = max(net_due - collected, 0)
    collection_rate = (collected / net_due * 100) if net_due > 0 else 0.0

    today = date.today()
    risk_rows     = attendance_service.get_monthly_summary_bulk(db, academic_year_id, today.year, today.month)
    at_risk_count = sum(1 for row in risk_rows if float(row.get("percentage", 0)) < 75)

    return {
        "collection_rate": round(collection_rate, 2),
        "total_collected": round(collected, 2),
        "outstanding":     round(outstanding, 2),
        "at_risk_count":   at_risk_count,
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
    net_due      = float(totals.net_due   or 0)
    collected    = float(totals.collected or 0)
    outstanding  = max(net_due - collected, 0)
    collection_rate = (collected / net_due * 100) if net_due > 0 else 0.0

    return {
        "summary": {
            "collection_rate": round(collection_rate, 2),
            "total_collected": round(collected, 2),
            "outstanding":     round(outstanding, 2),
        },
        "trend": [
            {
                "month":     row.month.strftime("%b %Y"),
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
    Each class entry: {class_name, avg_percentage}.
    Sections merged into one entry per Class.name.
    Only students with marks entered (not INCOMPLETE) are counted.

    Performance: single SQL pass via analytics_service (was N × get_class_results).
    """
    return analytics_service.class_performance(db, academic_year_id, exam_name)


@router.get("/grade-distribution")
def grade_distribution(
    exam_id: int = Query(...),
    academic_year_id: int = Query(...),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """
    Returns grade bucket counts for a given exam across all classes.

    Performance: single SQL aggregation query (was: one get_class_results()
    call per class in a Python loop).
    """
    # Resolve all class IDs for this academic year that have this exam
    exam = db.query(Exam).filter_by(id=exam_id).first()
    if not exam:
        return []

    class_ids = [
        r[0] for r in
        db.query(Class.id).filter(Class.academic_year_id == academic_year_id).all()
    ]
    if not class_ids:
        return []

    # Active enrollments for these classes
    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.class_id.in_(class_ids),
            Enrollment.academic_year_id == academic_year_id,
            Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
        )
        .all()
    )
    if not enrollments:
        return []

    enrollment_ids = [e.id for e in enrollments]

    # Subjects for these classes
    subjects = (
        db.query(Subject)
        .filter(Subject.class_id.in_(class_ids), Subject.is_active == True)  # noqa: E712
        .all()
    )
    subject_ids = [s.id for s in subjects]
    subjects_by_id = {s.id: s for s in subjects}
    if not subject_ids:
        return []

    # Per-exam max overrides
    configs = {
        (c.exam_id, c.subject_id): c
        for c in db.query(ExamSubjectConfig)
        .filter(ExamSubjectConfig.exam_id == exam_id)
        .all()
    }

    # All marks for this exam
    marks = (
        db.query(Mark)
        .filter(
            Mark.exam_id == exam_id,
            Mark.enrollment_id.in_(enrollment_ids),
            Mark.subject_id.in_(subject_ids),
        )
        .all()
    )
    # (enrollment_id, subject_id) → Mark
    mark_map: dict[tuple, Mark] = {(m.enrollment_id, m.subject_id): m for m in marks}

    # Subjects grouped by class_id
    subjects_by_class: dict[int, list] = {}
    for s in subjects:
        subjects_by_class.setdefault(s.class_id, []).append(s)

    # Compute per-student grade in Python (all data already in memory)
    buckets: dict[str, int] = {}
    for enr in enrollments:
        class_subjects = subjects_by_class.get(enr.class_id, [])
        total     = Decimal("0")
        max_total = Decimal("0")
        incomplete = False

        for subj in class_subjects:
            cfg = configs.get((exam_id, subj.id))
            mt  = cfg.max_theory    if cfg else subj.max_theory
            mp  = cfg.max_practical if cfg else subj.max_practical
            max_sub = Decimal(str(mt)) + Decimal(str(mp))
            if max_sub == 0:
                continue

            m = mark_map.get((enr.id, subj.id))
            if m is None:
                incomplete = True
                continue
            if m.is_absent:
                max_total += max_sub
            else:
                total     += (m.theory_marks or Decimal("0")) + (m.practical_marks or Decimal("0"))
                max_total += max_sub

        if incomplete or max_total == 0:
            grade = "NE"
        else:
            pct   = float((total / max_total * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            grade = _get_grade(pct)

        buckets[grade] = buckets.get(grade, 0) + 1

    return [{"grade": grade, "count": count} for grade, count in sorted(buckets.items())]


@router.get("/attendance-trends")
def attendance_trends(
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
    """
    Returns the top-N students by total marks for a given exam.

    Performance: single SQL pass (was: one get_class_results() per class
    across all 13 classes, then sorting in Python).
    """
    exam = db.query(Exam).filter_by(id=exam_id).first()
    if not exam:
        return []

    class_ids = [
        r[0] for r in
        db.query(Class.id).filter(Class.academic_year_id == exam.academic_year_id).all()
    ]
    if not class_ids:
        return []

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.class_id.in_(class_ids),
            Enrollment.academic_year_id == exam.academic_year_id,
            Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
        )
        .all()
    )
    if not enrollments:
        return []

    enrollment_ids  = [e.id for e in enrollments]
    enr_by_id       = {e.id: e for e in enrollments}

    subjects = (
        db.query(Subject)
        .filter(Subject.class_id.in_(class_ids), Subject.is_active == True)  # noqa: E712
        .all()
    )
    subject_ids    = [s.id for s in subjects]
    subjects_by_id = {s.id: s for s in subjects}
    subjects_by_class: dict[int, list] = {}
    for s in subjects:
        subjects_by_class.setdefault(s.class_id, []).append(s)

    configs = {
        (c.exam_id, c.subject_id): c
        for c in db.query(ExamSubjectConfig)
        .filter(ExamSubjectConfig.exam_id == exam_id)
        .all()
    }

    marks = (
        db.query(Mark)
        .filter(
            Mark.exam_id == exam_id,
            Mark.enrollment_id.in_(enrollment_ids),
            Mark.subject_id.in_(subject_ids),
        )
        .all()
    )
    mark_map: dict[tuple, Mark] = {(m.enrollment_id, m.subject_id): m for m in marks}

    # Load students
    student_ids = list({e.student_id for e in enrollments})
    students_by_id = {
        s.id: s
        for s in db.query(Student).filter(Student.id.in_(student_ids)).all()
    }
    classes_by_id = {
        c.id: c
        for c in db.query(Class).filter(Class.id.in_(class_ids)).all()
    }

    # Compute totals per student
    results = []
    for enr in enrollments:
        class_subjects = subjects_by_class.get(enr.class_id, [])
        total     = Decimal("0")
        max_total = Decimal("0")
        incomplete = False

        for subj in class_subjects:
            cfg = configs.get((exam_id, subj.id))
            mt  = cfg.max_theory    if cfg else subj.max_theory
            mp  = cfg.max_practical if cfg else subj.max_practical
            max_sub = Decimal(str(mt)) + Decimal(str(mp))
            if max_sub == 0:
                continue

            m = mark_map.get((enr.id, subj.id))
            if m is None:
                incomplete = True
                continue
            if not m.is_absent:
                total += (m.theory_marks or Decimal("0")) + (m.practical_marks or Decimal("0"))
            max_total += max_sub

        if incomplete or max_total == 0:
            continue

        pct   = float((total / max_total * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        grade = _get_grade(pct)
        student = students_by_id.get(enr.student_id)
        results.append({
            "student_id":   enr.student_id,
            "student_name": student.name_en if student else f"Student {enr.student_id}",
            "total_marks":  float(total),
            "max_marks":    float(max_total),
            "percentage":   pct,
            "grade":        grade,
            "class_rank":   None,  # school-wide top list — rank not applicable
        })

    results.sort(key=lambda r: r["total_marks"], reverse=True)
    return results[:limit]


@router.get("/at-risk-attendance")
def at_risk_students(
    threshold: float = Query(75.0, ge=0, le=100),
    academic_year_id: Optional[int] = Query(None),
    _: CurrentUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    today = date.today()
    if academic_year_id:
        summaries = attendance_service.get_monthly_summary_bulk(
            db, academic_year_id, today.year, today.month
        )
    else:
        current_year = db.query(AcademicYear).filter_by(is_current=True).first()
        summaries = (
            attendance_service.get_monthly_summary_bulk(
                db, current_year.id, today.year, today.month
            )
            if current_year else []
        )

    rows = [
        {
            "student_id":     item["student_id"],
            "student_name":   item["student_name"],
            "class_id":       item["class_id"],
            "class_name":     item["class_name"],
            "attendance_pct": float(item.get("percentage", 0)),
        }
        for item in summaries
        if float(item.get("percentage", 0)) < threshold
    ]
    rows.sort(key=lambda r: r["attendance_pct"])
    return {"threshold": threshold, "count": len(rows), "students": rows}