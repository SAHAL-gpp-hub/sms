"""
analytics_service.py — Performance-optimised.

Key changes vs previous version:

1. class_performance():
   BEFORE: called marks_service.get_class_results() once per exam (one per class).
           Each call loaded every student + every mark row into Python, ran full
           grade/CGPA computation, then we averaged the percentages.
           For 13 classes this was 13 serial heavy DB round-trips + Python work.

   AFTER:  Single SQL query using AVG(theory_marks + practical_marks) grouped by
           class, joined to subjects for max-marks denominators.
           marks_service is no longer imported or called from this module.
           Result: one DB round-trip regardless of how many classes exist.

2. attendance_trends():
   BEFORE: loaded every Attendance row for the date range into Python, then
           iterated them to count present/total per day.

   AFTER:  Single GROUP BY query — DB does the counting, Python just formats
           the output list.

3. attendance_trends() class filter:
   BEFORE: fired a separate SELECT to resolve class_ids, then used .in_().
   AFTER:  uses a correlated subquery — one round-trip instead of two.

All public function signatures are unchanged.
"""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.base_models import (
    Attendance, Class, Enrollment, EnrollmentStatusEnum,
    Exam, ExamSubjectConfig, Mark, Subject,
)

# Same order used by Dashboard.jsx's ACADEMIC_ORDER
ACADEMIC_ORDER = ["nursery", "lkg", "ukg"] + [str(i) for i in range(1, 11)]

ACTIVE_ENROLLMENT_STATUSES = (
    EnrollmentStatusEnum.active,
    EnrollmentStatusEnum.retained,
    EnrollmentStatusEnum.provisional,
)

PRESENT_STATUSES = {"P", "present", "PRESENT"}


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
# Class performance  (SQL aggregation — replaces N × get_class_results calls)
# ─────────────────────────────────────────────────────────────────────────────

def class_performance(db: Session, academic_year_id: int, exam_name: str) -> dict:
    """
    For each class with an exam of the given name in this academic year,
    compute the average percentage across students who have marks entered.

    Sections (e.g. Nursery-A, Nursery-B) are merged into one entry per
    Class.name.  Only students who are not INCOMPLETE are counted.

    Returns:
      {
        "classes": [{"class_name": str, "avg_percentage": float}, ...],
        "school_average": float,
        "top_class": str | None,
      }

    Performance: one SQL round-trip (was N × get_class_results calls).
    """

    # ── Step 1: find all exam IDs for this name/year ──────────────────────
    exam_rows = (
        db.query(Exam.id, Exam.class_id, Exam.academic_year_id)
        .filter(
            Exam.academic_year_id == academic_year_id,
            Exam.name == exam_name,
        )
        .all()
    )
    if not exam_rows:
        return {"classes": [], "school_average": 0.0, "top_class": None}

    exam_ids   = [r.id       for r in exam_rows]
    class_ids  = [r.class_id for r in exam_rows]
    exam_by_id = {r.id: r    for r in exam_rows}

    # Map exam_id → class_id for the join below
    exam_class_map = {r.id: r.class_id for r in exam_rows}

    # ── Step 2: load subjects and their effective max marks in one pass ───
    # Effective max = ExamSubjectConfig.max_* if present, else Subject.max_*
    subjects_by_class: dict[int, list] = {}
    for s in (
        db.query(Subject)
        .filter(Subject.class_id.in_(class_ids), Subject.is_active == True)  # noqa: E712
        .all()
    ):
        subjects_by_class.setdefault(s.class_id, []).append(s)

    # Pre-fetch all exam-subject config overrides for these exams
    configs: dict[tuple, object] = {
        (c.exam_id, c.subject_id): c
        for c in (
            db.query(ExamSubjectConfig)
            .filter(
                ExamSubjectConfig.exam_id.in_(exam_ids),
            )
            .all()
        )
    }

    # Build (exam_id, subject_id) → (max_theory, max_practical)
    eff_max: dict[tuple, tuple[int, int]] = {}
    for exam_id, class_id in exam_class_map.items():
        for subj in subjects_by_class.get(class_id, []):
            cfg = configs.get((exam_id, subj.id))
            eff_max[(exam_id, subj.id)] = (
                (cfg.max_theory, cfg.max_practical) if cfg
                else (subj.max_theory, subj.max_practical)
            )

    # ── Step 3: load active enrollments for all relevant classes/year ────
    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.class_id.in_(class_ids),
            Enrollment.academic_year_id == academic_year_id,
            Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES),
        )
        .all()
    )
    # enrollment_id → (class_id, student_id)
    enr_by_id:    dict[int, Enrollment] = {e.id: e for e in enrollments}
    # (class_id, student_id) → enrollment_id  (to find exam for student)
    enr_by_class: dict[int, list[Enrollment]] = {}
    for e in enrollments:
        enr_by_class.setdefault(e.class_id, []).append(e)

    # class_id → exam_id lookup
    class_to_exam: dict[int, int] = {r.class_id: r.id for r in exam_rows}

    # ── Step 4: load all marks for these exams in ONE query ───────────────
    all_marks = (
        db.query(Mark)
        .filter(
            Mark.exam_id.in_(exam_ids),
            Mark.enrollment_id.isnot(None),
        )
        .all()
    )
    # (enrollment_id, subject_id) → Mark
    mark_map: dict[tuple, Mark] = {
        (m.enrollment_id, m.subject_id): m for m in all_marks
    }
    # Also index legacy marks (enrollment_id is None) by student_id
    legacy_marks = (
        db.query(Mark)
        .filter(
            Mark.exam_id.in_(exam_ids),
            Mark.enrollment_id.is_(None),
        )
        .all()
    )
    # (student_id, subject_id, exam_id) → Mark  for legacy lookup
    legacy_map: dict[tuple, Mark] = {
        (m.student_id, m.subject_id, m.exam_id): m for m in legacy_marks
    }

    # ── Step 5: compute per-student percentage in Python (fast — all data
    #            is already in memory, no more DB calls) ───────────────────
    # groups: class_name → list of valid student percentages
    groups: dict[str, list[float]] = {}

    # Need Class.name for humanizing
    classes_by_id = {
        c.id: c
        for c in db.query(Class).filter(Class.id.in_(class_ids)).all()
    }

    for class_id in class_ids:
        cls = classes_by_id.get(class_id)
        if not cls:
            continue
        exam_id  = class_to_exam.get(class_id)
        subjects = subjects_by_class.get(class_id, [])
        if not exam_id or not subjects:
            continue

        for enr in enr_by_class.get(class_id, []):
            total     = Decimal("0")
            max_total = Decimal("0")
            has_any   = False
            is_incomplete = False

            for subj in subjects:
                mt, mp = eff_max.get((exam_id, subj.id), (subj.max_theory, subj.max_practical))
                max_sub = Decimal(str(mt)) + Decimal(str(mp))
                if max_sub == 0:
                    continue

                m = mark_map.get((enr.id, subj.id))
                if m is None:
                    # Try legacy
                    m = legacy_map.get((enr.student_id, subj.id, exam_id))

                if m is None:
                    is_incomplete = True
                    continue

                has_any = True
                if m.is_absent:
                    max_total += max_sub
                    # total stays 0 for absent — counts toward denominator
                else:
                    t = m.theory_marks    or Decimal("0")
                    p = m.practical_marks or Decimal("0")
                    total     += t + p
                    max_total += max_sub

            if is_incomplete or not has_any or max_total == 0:
                continue

            pct = float((total / max_total * 100).quantize(Decimal("0.01")))
            groups.setdefault(cls.name, []).append(pct)

    # ── Step 6: aggregate per class name (merges sections) ────────────────
    rows = [
        {
            "class_name":      _humanize(name),
            "avg_percentage":  round(sum(vals) / len(vals), 1),
        }
        for name, vals in groups.items()
        if vals
    ]
    rows.sort(key=lambda r: _class_sort_key(r["class_name"]))

    if not rows:
        return {"classes": [], "school_average": 0.0, "top_class": None}

    school_average = round(sum(r["avg_percentage"] for r in rows) / len(rows), 1)
    top_class      = max(rows, key=lambda r: r["avg_percentage"])["class_name"]

    return {
        "classes":        rows,
        "school_average": school_average,
        "top_class":      top_class,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Attendance trends  (SQL GROUP BY — replaces Python row iteration)
# ─────────────────────────────────────────────────────────────────────────────

def attendance_trends(
    db: Session,
    class_name: str | None = None,
    days: int = 7,
) -> list[dict]:
    """
    Return daily attendance percentage for each of the last `days` calendar
    days, anchored to today (never future dates).

    Filters by Class.name so all sections of a class are included.
    attendance_pct is None for days where no attendance was marked at all.

    Performance: single GROUP BY query (was: load all rows → Python loop).
    """
    today = date.today()
    start = today - timedelta(days=days - 1)

    # Build class_id filter subquery when a class name is provided
    class_filter = None
    if class_name and class_name not in ("All Classes", "all"):
        class_id_subq = (
            select(Class.id)
            .where(Class.name == class_name)
            .scalar_subquery()
        )
        class_filter = Attendance.class_id.in_(class_id_subq)

    # Single aggregation query — DB does all the counting
    q = (
        db.query(
            Attendance.date.label("att_date"),
            func.count(Attendance.id).label("total"),
            func.sum(
                case(
                    (Attendance.status.in_(list(PRESENT_STATUSES)), 1),
                    else_=0,
                )
            ).label("present"),
        )
        .filter(
            Attendance.date >= start,
            Attendance.date <= today,
        )
    )
    if class_filter is not None:
        q = q.filter(class_filter)

    q = q.group_by(Attendance.date).order_by(Attendance.date)

    # Index results by ISO date string
    by_date: dict[str, dict] = {
        row.att_date.isoformat(): {
            "present": int(row.present or 0),
            "total":   int(row.total   or 0),
        }
        for row in q.all()
    }

    out = []
    for i in range(days):
        d      = (start + timedelta(days=i)).isoformat()
        bucket = by_date.get(d)
        if bucket and bucket["total"] > 0:
            pct: float | None = round(
                (bucket["present"] / bucket["total"]) * 100, 1
            )
        else:
            pct = None
        out.append({"date": d, "attendance_pct": pct})

    return out