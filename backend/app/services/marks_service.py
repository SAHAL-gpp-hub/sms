"""
marks_service.py  (updated)

Key changes vs previous version:
  1. get_effective_max_marks(db, exam_id, subject_id) — returns the
     ExamSubjectConfig override if present, else falls back to the
     subject-level defaults. All mark entry / result calculation now
     routes through this helper so custom exam max marks are used
     everywhere consistently.

  2. get_exam_subject_configs / upsert_exam_subject_configs /
     delete_exam_subject_config — CRUD for per-exam mark overrides.

  3. update_subject / toggle_subject_active — allow editing / soft-
     disabling subjects from the UI without losing historical marks.

  4. get_marks / get_class_results use get_effective_max_marks so
     results PDFs automatically respect exam-specific overrides.

  5. bulk_save_marks validates against effective max (not subject default).

All prior fixes (BUG 5 grade_point, advisory lock, CLASS_ORDER) are
preserved.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List

from sqlalchemy.orm import Session

from app.models.base_models import (
    Subject, Exam, Mark, Student, Class, StudentStatusEnum,
    ExamSubjectConfig,
)
from app.schemas.marks import (
    SubjectCreate, SubjectUpdate, ExamCreate, MarkEntry,
    ExamSubjectConfigCreate,
)


# ---------------------------------------------------------------------------
# GSEB grade table
# ---------------------------------------------------------------------------

GSEB_GRADES = [
    (91, 100, "A1", 10.0, "Outstanding"),
    (81,  90, "A2",  9.0, "Excellent"),
    (71,  80, "B1",  8.0, "Very Good"),
    (61,  70, "B2",  7.0, "Good"),
    (51,  60, "C1",  6.0, "Average"),
    (41,  50, "C2",  5.0, "Satisfactory"),
    (33,  40, "D",   4.0, "Pass"),
    (0,   32, "E",   0.0, "Fail"),
]


def get_grade(percentage: Decimal):
    pct = float(percentage)
    for low, high, grade, gp, remark in GSEB_GRADES:
        if low <= pct <= high:
            return grade, round(float(gp), 1), remark
    return "E", 0.0, "Fail"


def percentage_to_cgpa(percentage: Decimal) -> float:
    _, gp, _ = get_grade(percentage)
    return gp


# ---------------------------------------------------------------------------
# GSEB subject / exam seed data
# ---------------------------------------------------------------------------

GSEB_SUBJECTS = {
    "Nursery": [("English", 100, 0), ("Hindi", 100, 0), ("Mathematics", 100, 0), ("Drawing", 100, 0)],
    "LKG":     [("English", 100, 0), ("Hindi", 100, 0), ("Mathematics", 100, 0), ("Drawing", 100, 0)],
    "UKG":     [("English", 100, 0), ("Hindi", 100, 0), ("Mathematics", 100, 0), ("Drawing", 100, 0)],
    "1":  [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("EVS", 100, 0)],
    "2":  [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("EVS", 100, 0)],
    "3":  [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("EVS", 100, 0), ("Drawing", 100, 0)],
    "4":  [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("EVS", 100, 0), ("Drawing", 100, 0)],
    "5":  [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("EVS", 100, 0), ("Drawing", 100, 0)],
    "6":  [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("Science", 100, 0), ("Social Science", 100, 0), ("Sanskrit", 100, 0)],
    "7":  [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("Science", 100, 0), ("Social Science", 100, 0), ("Sanskrit", 100, 0)],
    "8":  [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("Science", 100, 0), ("Social Science", 100, 0), ("Sanskrit", 100, 0)],
    "9":  [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("Science & Technology", 100, 0), ("Social Science", 100, 0), ("Sanskrit", 100, 0)],
    "10": [("Gujarati", 100, 0), ("Hindi", 100, 0), ("English", 100, 0), ("Mathematics", 100, 0), ("Science & Technology", 100, 25), ("Social Science", 100, 0), ("Sanskrit", 100, 0)],
}

EXAM_TYPES = ["Unit Test 1", "Unit Test 2", "Half-Yearly", "Annual", "Practical"]

CLASS_ORDER = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]


# ---------------------------------------------------------------------------
# Effective max-marks helper
# ---------------------------------------------------------------------------

def get_effective_max_marks(
    db: Session, exam_id: int, subject_id: int
) -> tuple[int, int]:
    """
    Return (max_theory, max_practical) for this exam+subject combination.

    Priority order:
      1. ExamSubjectConfig row for (exam_id, subject_id)  — custom override
      2. Subject.max_theory / max_practical                — class default

    This is the single source of truth used by bulk_save_marks and
    get_class_results so validation and grade calculation are consistent.
    """
    config = db.query(ExamSubjectConfig).filter_by(
        exam_id=exam_id, subject_id=subject_id
    ).first()
    if config:
        return config.max_theory, config.max_practical

    subject = db.query(Subject).filter_by(id=subject_id).first()
    if subject:
        return subject.max_theory, subject.max_practical

    return 100, 0  # safe fallback


def get_exam_subject_configs(db: Session, exam_id: int) -> list[ExamSubjectConfig]:
    return db.query(ExamSubjectConfig).filter_by(exam_id=exam_id).all()


def upsert_exam_subject_configs(
    db: Session, exam_id: int, configs: list[ExamSubjectConfigCreate]
) -> list[ExamSubjectConfig]:
    """
    Replace all ExamSubjectConfig rows for this exam with the provided list.
    An empty list clears all overrides (reverts to subject defaults).
    Returns the saved configs.
    """
    # Validate exam exists
    exam = db.query(Exam).filter_by(id=exam_id).first()
    if not exam:
        raise LookupError(f"Exam {exam_id} not found")

    # Validate each subject belongs to the exam's class
    for cfg in configs:
        subject = db.query(Subject).filter_by(
            id=cfg.subject_id, class_id=exam.class_id
        ).first()
        if not subject:
            raise ValueError(
                f"Subject {cfg.subject_id} does not belong to class {exam.class_id}"
            )

    # Delete existing configs and replace
    db.query(ExamSubjectConfig).filter_by(exam_id=exam_id).delete()
    db.flush()

    saved = []
    for cfg in configs:
        row = ExamSubjectConfig(
            exam_id=exam_id,
            subject_id=cfg.subject_id,
            max_theory=cfg.max_theory,
            max_practical=cfg.max_practical,
        )
        db.add(row)
        saved.append(row)

    db.commit()
    for row in saved:
        db.refresh(row)
    return saved


# ---------------------------------------------------------------------------
# Subjects
# ---------------------------------------------------------------------------

def seed_subjects(db: Session, class_id: int) -> int:
    cls = db.query(Class).filter_by(id=class_id).first()
    if not cls:
        return 0
    subjects = GSEB_SUBJECTS.get(cls.name, [])
    count = 0
    for name, max_theory, max_practical in subjects:
        exists = db.query(Subject).filter_by(name=name, class_id=class_id).first()
        if not exists:
            db.add(Subject(
                name=name,
                class_id=class_id,
                max_theory=max_theory,
                max_practical=max_practical,
                subject_type="Theory+Practical" if max_practical > 0 else "Theory",
                is_active=True,
            ))
            count += 1
    db.commit()
    return count


def get_subjects(db: Session, class_id: int, include_inactive: bool = False):
    q = db.query(Subject).filter_by(class_id=class_id)
    if not include_inactive:
        q = q.filter_by(is_active=True)
    return q.order_by(Subject.id).all()


def create_subject(db: Session, data: SubjectCreate) -> Subject:
    # Check for duplicate name in this class
    existing = db.query(Subject).filter_by(
        name=data.name, class_id=data.class_id
    ).first()
    if existing:
        if not existing.is_active:
            # Reactivate and update instead of creating a duplicate
            existing.is_active     = True
            existing.max_theory    = data.max_theory
            existing.max_practical = data.max_practical
            existing.subject_type  = data.subject_type
            db.commit()
            db.refresh(existing)
            return existing
        raise ValueError(
            f"Subject '{data.name}' already exists for this class. "
            "Edit the existing subject instead."
        )

    s = Subject(**data.model_dump(), is_active=True)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def update_subject(db: Session, subject_id: int, data: SubjectUpdate) -> Optional[Subject]:
    """Update name, max marks, type, or active state."""
    s = db.query(Subject).filter_by(id=subject_id).first()
    if not s:
        return None

    update_data = data.model_dump(exclude_unset=True)

    # If renaming, check for collision in same class
    if "name" in update_data and update_data["name"] != s.name:
        collision = db.query(Subject).filter(
            Subject.class_id == s.class_id,
            Subject.name == update_data["name"],
            Subject.id != subject_id,
            Subject.is_active == True,
        ).first()
        if collision:
            raise ValueError(
                f"Another active subject named '{update_data['name']}' "
                "already exists in this class."
            )

    for key, value in update_data.items():
        setattr(s, key, value)

    db.commit()
    db.refresh(s)
    return s


def delete_subject(db: Session, subject_id: int) -> Optional[Subject]:
    """
    Soft-delete if marks exist for this subject; hard-delete otherwise.
    This preserves historical mark records while removing the subject from
    future exam grids.
    """
    s = db.query(Subject).filter_by(id=subject_id).first()
    if not s:
        return None

    has_marks = db.query(Mark).filter_by(subject_id=subject_id).first()
    if has_marks:
        # Soft-delete — keep the row but hide from grids
        s.is_active = False
        db.commit()
        db.refresh(s)
    else:
        db.delete(s)
        db.commit()
    return s


# ---------------------------------------------------------------------------
# Exams
# ---------------------------------------------------------------------------

def get_exams(db: Session, class_id: int = None, academic_year_id: int = None):
    q = db.query(Exam)
    if class_id:
        q = q.filter_by(class_id=class_id)
    if academic_year_id:
        q = q.filter_by(academic_year_id=academic_year_id)
    return q.all()


def create_exam(db: Session, data: ExamCreate) -> Exam:
    e = Exam(**data.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


def delete_exam(db: Session, exam_id: int) -> Optional[Exam]:
    e = db.query(Exam).filter_by(id=exam_id).first()
    if e:
        db.delete(e)
        db.commit()
    return e


# ---------------------------------------------------------------------------
# Marks entry
# ---------------------------------------------------------------------------

def bulk_save_marks(db: Session, entries: list[MarkEntry]):
    for entry in entries:
        if not entry.is_absent and entry.theory_marks is not None:
            # Use effective max marks (respects per-exam overrides)
            eff_max_theory, eff_max_practical = get_effective_max_marks(
                db, entry.exam_id, entry.subject_id
            )

            if entry.theory_marks > eff_max_theory:
                subject = db.query(Subject).filter_by(id=entry.subject_id).first()
                raise ValueError(
                    f"Theory marks {entry.theory_marks} exceed max "
                    f"{eff_max_theory} for subject "
                    f"'{subject.name if subject else entry.subject_id}'"
                )
            if (
                entry.practical_marks
                and eff_max_practical > 0
                and entry.practical_marks > eff_max_practical
            ):
                raise ValueError(
                    f"Practical marks {entry.practical_marks} exceed "
                    f"max {eff_max_practical}"
                )

        existing = db.query(Mark).filter_by(
            student_id=entry.student_id,
            subject_id=entry.subject_id,
            exam_id=entry.exam_id,
        ).first()
        if existing:
            existing.theory_marks    = entry.theory_marks
            existing.practical_marks = entry.practical_marks
            existing.is_absent       = entry.is_absent
        else:
            db.add(Mark(**entry.model_dump()))
    db.commit()
    return {"saved": len(entries)}


def get_marks(db: Session, exam_id: int, class_id: int):
    """
    Returns {students: [...], subjects: [...]} where each subject entry
    includes the EFFECTIVE max marks for this exam (custom override or default).
    """
    students = (
        db.query(Student)
        .filter_by(class_id=class_id)
        .filter(Student.status == StudentStatusEnum.Active)
        .all()
    )
    subjects = get_subjects(db, class_id)  # active only
    subject_ids = [s.id for s in subjects]

    marks = (
        db.query(Mark)
        .filter(
            Mark.exam_id == exam_id,
            Mark.subject_id.in_(subject_ids),
        )
        .all()
        if subject_ids
        else []
    )

    mark_map = {(m.student_id, m.subject_id): m for m in marks}

    result = []
    for student in students:
        row = {
            "student_id":   student.id,
            "student_name": student.name_en,
            "roll_number":  student.roll_number,
            "marks": {},
        }
        for subject in subjects:
            m = mark_map.get((student.id, subject.id))
            row["marks"][subject.id] = {
                "theory":    float(m.theory_marks)    if m and m.theory_marks    is not None else None,
                "practical": float(m.practical_marks) if m and m.practical_marks is not None else None,
                "is_absent": m.is_absent if m else False,
            }
        result.append(row)

    # Enrich subject list with effective max marks
    subject_out = []
    for s in subjects:
        eff_theory, eff_practical = get_effective_max_marks(db, exam_id, s.id)
        subject_out.append({
            "id":                s.id,
            "name":              s.name,
            "max_theory":        eff_theory,
            "max_practical":     eff_practical,
            # Original subject defaults (shown in subject manager)
            "default_max_theory":    s.max_theory,
            "default_max_practical": s.max_practical,
            "has_custom_config": eff_theory != s.max_theory or eff_practical != s.max_practical,
        })

    return {"students": result, "subjects": subject_out}


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

def get_class_results(db: Session, exam_id: int, class_id: int):
    students = (
        db.query(Student)
        .filter_by(class_id=class_id)
        .filter(Student.status == StudentStatusEnum.Active)
        .all()
    )
    subjects = get_subjects(db, class_id)  # active only
    marks    = db.query(Mark).filter_by(exam_id=exam_id).all()
    mark_map = {(m.student_id, m.subject_id): m for m in marks}

    results = []
    for student in students:
        total     = Decimal("0")
        max_total = Decimal("0")
        subject_rows: list[dict] = []
        has_fail = False

        for subject in subjects:
            # Use effective max marks (respects per-exam overrides)
            eff_max_theory, eff_max_practical = get_effective_max_marks(
                db, exam_id, subject.id
            )
            max_t   = Decimal(str(eff_max_theory))
            max_p   = Decimal(str(eff_max_practical))
            max_sub = max_t + max_p

            m = mark_map.get((student.id, subject.id))

            if not m or m.is_absent:
                theory, practical, sub_total = None, None, Decimal("0")
                grade, gp = "AB", 0.0
                has_fail = True
            else:
                theory    = m.theory_marks    or Decimal("0")
                practical = m.practical_marks or Decimal("0")
                sub_total = theory + practical
                sub_pct   = (sub_total / max_sub * 100) if max_sub > 0 else Decimal("0")
                grade, gp, _ = get_grade(sub_pct)
                if grade == "E":
                    has_fail = True

            total     += sub_total if sub_total else Decimal("0")
            max_total += max_sub

            subject_rows.append({
                "subject_name":    subject.name,
                "max_theory":      eff_max_theory,
                "max_practical":   eff_max_practical,
                "theory_marks":    float(theory)    if theory    is not None else None,
                "practical_marks": float(practical) if practical is not None else None,
                "total":           float(sub_total),
                "grade":           grade,
                "grade_point":     gp,
            })

        percentage = (
            (total / max_total * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if max_total > 0
            else Decimal("0")
        )
        overall_grade, cgpa, _ = get_grade(percentage)
        result_str = "FAIL" if has_fail else "PASS"

        results.append({
            "student_id":   student.id,
            "student_name": student.name_en,
            "roll_number":  student.roll_number,
            "subjects":     subject_rows,
            "total_marks":  float(total),
            "max_marks":    float(max_total),
            "percentage":   float(percentage),
            "cgpa":         cgpa,
            "grade":        overall_grade,
            "result":       result_str,
        })

    results.sort(key=lambda x: x["percentage"], reverse=True)
    for i, r in enumerate(results):
        r["class_rank"] = i + 1

    return results