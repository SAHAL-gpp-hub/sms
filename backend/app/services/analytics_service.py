"""
analytics_service.py

Provides real-data analytics computations for the admin dashboard:
  - class_performance(): per-class average marks for a given exam name
  - attendance_trends():  daily attendance % for the past N days, never future dates
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.base_models import Attendance, Class, Exam
from app.services import marks_service

# Same order used by Dashboard.jsx's ACADEMIC_ORDER
ACADEMIC_ORDER = ["nursery", "lkg", "ukg"] + [str(i) for i in range(1, 11)]


def _class_sort_key(class_name: str):
    clean = class_name.strip().lower().removeprefix("class ").strip()
    try:
        return (ACADEMIC_ORDER.index(clean), class_name)
    except ValueError:
        return (999, class_name)


def _humanize(name: str) -> str:
    """'1' → 'Class 1', 'nursery' → 'Nursery', 'lkg' → 'LKG', etc."""
    low = name.strip().lower()
    if low == "nursery":
        return "Nursery"
    if low in ("lkg", "ukg"):
        return low.upper()
    try:
        int(name.strip())
        return f"Class {name.strip()}"
    except ValueError:
        return name


# ─────────────────────────────────────────────────────────────────────────────
# Class performance
# ─────────────────────────────────────────────────────────────────────────────

def class_performance(db: Session, academic_year_id: int, exam_name: str) -> dict:
    """
    For each class that has an exam with the given name in this academic year,
    compute the average percentage across all students who have marks entered.

    Sections (e.g. Nursery-A, Nursery-B) are merged into a single class entry
    by grouping on Class.name before returning.

    Returns:
      {
        "classes": [{"class_name": str, "avg_percentage": float}, ...],
        "school_average": float,
        "top_class": str | None
      }
    """
    exams = (
        db.query(Exam)
        .filter(
            Exam.academic_year_id == academic_year_id,
            Exam.name == exam_name,
        )
        .all()
    )
    if not exams:
        return {"classes": [], "school_average": 0.0, "top_class": None}

    # Batch-load all relevant classes to avoid N+1
    class_ids = [e.class_id for e in exams]
    classes_by_id = {
        c.id: c
        for c in db.query(Class).filter(Class.id.in_(class_ids)).all()
    }

    # FIX A: group by Class.name to merge sections (Nursery-A + Nursery-B → Nursery)
    groups: dict[str, list[float]] = {}
    for exam in exams:
        cls = classes_by_id.get(exam.class_id)
        if not cls:
            continue

        class_results = marks_service.get_class_results(db, exam.id, exam.class_id)
        if not class_results:
            continue

        # Only include students with marks actually entered (not INCOMPLETE)
        valid = [r for r in class_results if not r.get("is_incomplete")]
        if not valid:
            continue

        avg_pct = sum(r["percentage"] for r in valid) / len(valid)
        groups.setdefault(cls.name, []).append(float(avg_pct))

    rows = [
        {
            "class_name": _humanize(name),
            "avg_percentage": round(sum(vals) / len(vals), 1),
        }
        for name, vals in groups.items()
    ]
    rows.sort(key=lambda r: _class_sort_key(r["class_name"]))

    if not rows:
        return {"classes": [], "school_average": 0.0, "top_class": None}

    school_average = round(sum(r["avg_percentage"] for r in rows) / len(rows), 1)
    top_class = max(rows, key=lambda r: r["avg_percentage"])["class_name"]

    return {
        "classes": rows,
        "school_average": school_average,
        "top_class": top_class,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Attendance trends
# ─────────────────────────────────────────────────────────────────────────────

# FIX D support: accept any casing of stored status values
PRESENT_STATUSES = {"P", "present", "PRESENT"}

def attendance_trends(
    db: Session,
    class_name: str | None = None,   # FIX C: filter by name, not id
    days: int = 7,
) -> list[dict]:
    """
    Return daily attendance percentage for each of the last `days` calendar days,
    anchored to today (never future dates).

    FIX C: filters by Class.name (covers all sections/divisions of a class).
    attendance_pct is None for days where no attendance has been marked at all.
    """
    today = date.today()
    start = today - timedelta(days=days - 1)

    q = db.query(Attendance).filter(
        Attendance.date >= start,
        Attendance.date <= today,   # hard upper bound — never future dates
    )

    # FIX C: resolve all section class_ids matching the given name
    if class_name and class_name not in ("All Classes", "all"):
        matching_ids = [
            c.id
            for c in db.query(Class).filter(Class.name == class_name).all()
        ]
        if matching_ids:
            q = q.filter(Attendance.class_id.in_(matching_ids))

    by_date: dict[str, dict] = {}
    for row in q.all():
        d = row.date.isoformat()
        bucket = by_date.setdefault(d, {"present": 0, "total": 0})
        bucket["total"] += 1
        if row.status in PRESENT_STATUSES:   # FIX D: multi-value status check
            bucket["present"] += 1

    out = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        bucket = by_date.get(d)
        if bucket and bucket["total"] > 0:
            pct: float | None = round(
                (bucket["present"] / bucket["total"]) * 100, 1
            )
        else:
            pct = None  # no attendance marked that day
        out.append({"date": d, "attendance_pct": pct})

    return out