"""
marks_service.py — Updated.

Key addition vs original:
  bulk_save_marks() now checks Mark.locked_at before allowing writes.
  If a mark record is locked (locked_at is set), the write is rejected
  with a clear error message.

  This enforces the planning doc requirement:
  "Once an academic year is closed, exam marks are locked. No edits should
  be permitted without a special admin override."

All other existing behaviour preserved.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.models.base_models import (
    Subject, Exam, Mark, Student, Class, StudentStatusEnum, Enrollment,
    ExamSubjectConfig,
)
from app.core.constants import CLASS_ORDER
from app.schemas.marks import (
    SubjectCreate, SubjectUpdate, ExamCreate, MarkEntry,
    ExamSubjectConfigCreate,
)

# ─────────────────────────────────────────────────────────────────────────────
# GSEB grade table
# ─────────────────────────────────────────────────────────────────────────────

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

EXAM_TYPES  = ["Unit Test 1", "Unit Test 2", "Half-Yearly", "Annual", "Practical"]
def get_grade(percentage: Decimal):
    pct = float(percentage)
    if pct > 100.0:
        raise ValueError("Percentage cannot exceed 100")
    pct = max(pct, 0.0)
    for low, high, grade, gp, remark in GSEB_GRADES:
        if low <= pct <= high:
            return grade, round(float(gp), 1), remark
    return "E", 0.0, "Fail"


def percentage_to_cgpa(percentage: Decimal) -> float:
    _, gp, _ = get_grade(percentage)
    return gp


def get_effective_max_marks(db: Session, exam_id: int, subject_id: int) -> tuple[int, int]:
    try:
        config = db.query(ExamSubjectConfig).filter_by(
            exam_id=exam_id, subject_id=subject_id
        ).first()
        if config:
            return config.max_theory, config.max_practical
    except (OperationalError, ProgrammingError):
        pass
    subject = db.query(Subject).filter_by(id=subject_id).first()
    if subject:
        return subject.max_theory, subject.max_practical
    return 100, 0


def get_exam_subject_configs(db: Session, exam_id: int) -> list:
    try:
        return db.query(ExamSubjectConfig).filter_by(exam_id=exam_id).all()
    except (OperationalError, ProgrammingError):
        return []


def upsert_exam_subject_configs(
    db: Session, exam_id: int, configs: list[ExamSubjectConfigCreate]
) -> list:
    exam = db.query(Exam).filter_by(id=exam_id).first()
    if not exam:
        raise LookupError(f"Exam {exam_id} not found")
    for cfg in configs:
        subject = db.query(Subject).filter_by(id=cfg.subject_id, class_id=exam.class_id).first()
        if not subject:
            raise ValueError(f"Subject {cfg.subject_id} does not belong to class {exam.class_id}")
    try:
        db.query(ExamSubjectConfig).filter_by(exam_id=exam_id).delete()
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
        db.flush()
        db.commit()
        for row in saved:
            db.refresh(row)
        return saved
    except (OperationalError, ProgrammingError) as e:
        db.rollback()
        raise ValueError("Could not save exam configs — run alembic upgrade head") from e


# ─────────────────────────────────────────────────────────────────────────────
# Subjects
# ─────────────────────────────────────────────────────────────────────────────

def _has_is_active_column(db: Session) -> bool:
    try:
        db.execute(text("SELECT is_active FROM subjects LIMIT 1"))
        return True
    except (OperationalError, ProgrammingError):
        db.rollback()
        return False


def seed_subjects(db: Session, class_id: int) -> int:
    cls = db.query(Class).filter_by(id=class_id).first()
    if not cls:
        return 0
    subjects = GSEB_SUBJECTS.get(cls.name, [])
    has_col  = _has_is_active_column(db)
    count    = 0
    for name, max_theory, max_practical in subjects:
        exists = db.query(Subject).filter_by(name=name, class_id=class_id).first()
        if not exists:
            kwargs = dict(
                name=name, class_id=class_id,
                max_theory=max_theory, max_practical=max_practical,
                subject_type="Theory+Practical" if max_practical > 0 else "Theory",
            )
            if has_col:
                kwargs["is_active"] = True
            db.add(Subject(**kwargs))
            count += 1
    db.commit()
    return count


def get_subjects(db: Session, class_id: int, include_inactive: bool = False):
    q = db.query(Subject).filter_by(class_id=class_id)
    if not include_inactive:
        try:
            q = q.filter(Subject.is_active == True)  # noqa: E712
            return q.order_by(Subject.id).all()
        except (OperationalError, ProgrammingError):
            db.rollback()
            return db.query(Subject).filter_by(class_id=class_id).order_by(Subject.id).all()
    return q.order_by(Subject.id).all()


def create_subject(db: Session, data: SubjectCreate) -> Subject:
    has_col = _has_is_active_column(db)
    existing = db.query(Subject).filter_by(name=data.name, class_id=data.class_id).first()
    if existing:
        if has_col and not existing.is_active:
            existing.is_active     = True
            existing.max_theory    = data.max_theory
            existing.max_practical = data.max_practical
            existing.subject_type  = data.subject_type
            db.commit()
            db.refresh(existing)
            return existing
        raise ValueError(f"Subject '{data.name}' already exists for this class.")
    kwargs = data.model_dump()
    if has_col:
        kwargs["is_active"] = True
    s = Subject(**kwargs)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def update_subject(db: Session, subject_id: int, data: SubjectUpdate) -> Optional[Subject]:
    s = db.query(Subject).filter_by(id=subject_id).first()
    if not s:
        return None
    update_data = data.model_dump(exclude_unset=True)
    has_col = _has_is_active_column(db)
    if not has_col:
        update_data.pop("is_active", None)
    for key, value in update_data.items():
        setattr(s, key, value)
    db.commit()
    db.refresh(s)
    return s


def delete_subject(db: Session, subject_id: int) -> Optional[Subject]:
    s = db.query(Subject).filter_by(id=subject_id).first()
    if not s:
        return None
    has_marks = db.query(Mark).filter_by(subject_id=subject_id).first()
    has_col   = _has_is_active_column(db)
    if has_marks and has_col:
        s.is_active = False
        db.commit()
        db.refresh(s)
    else:
        db.delete(s)
        db.commit()
    return s


# ─────────────────────────────────────────────────────────────────────────────
# Exams
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# Marks entry — with lock enforcement
# ─────────────────────────────────────────────────────────────────────────────

def bulk_save_marks(db: Session, entries: list[MarkEntry]):
    """
    UPDATED: Rejects writes to marks that have been locked (locked_at is set).
    This enforces year-end immutability after lock_marks_for_year() is called.
    """
    for entry in entries:
        student = db.query(Student).filter_by(id=entry.student_id).first()
        subject = db.query(Subject).filter_by(id=entry.subject_id).first()
        exam = db.query(Exam).filter_by(id=entry.exam_id).first()
        if student is None:
            raise ValueError(f"Student {entry.student_id} not found")
        if subject is None:
            raise ValueError(f"Subject {entry.subject_id} not found")
        if exam is None:
            raise ValueError(f"Exam {entry.exam_id} not found")
        enrolled_for_exam = db.query(Enrollment.id).filter_by(
            student_id=student.id,
            class_id=exam.class_id,
            academic_year_id=exam.academic_year_id,
        ).first()
        if student.class_id != exam.class_id and not enrolled_for_exam:
            raise ValueError(f"Student {student.id} does not belong to exam class {exam.class_id}")
        if subject.class_id != exam.class_id:
            raise ValueError(f"Subject {subject.id} does not belong to exam class {exam.class_id}")

        if not entry.is_absent and entry.theory_marks is not None:
            if entry.theory_marks < 0:
                raise ValueError("Theory marks cannot be negative")
            if entry.practical_marks is not None and entry.practical_marks < 0:
                raise ValueError("Practical marks cannot be negative")

            eff_max_theory, eff_max_practical = get_effective_max_marks(
                db, entry.exam_id, entry.subject_id
            )
            if entry.theory_marks > eff_max_theory:
                raise ValueError(
                    f"Theory marks {entry.theory_marks} exceed max {eff_max_theory} "
                    f"for subject '{subject.name}'"
                )
            if (entry.practical_marks and eff_max_practical > 0
                    and entry.practical_marks > eff_max_practical):
                raise ValueError(
                    f"Practical marks {entry.practical_marks} exceed max {eff_max_practical}"
                )

        existing = db.query(Mark).filter_by(
            student_id=entry.student_id,
            subject_id=entry.subject_id,
            exam_id=entry.exam_id,
        ).first()

        if existing:
            # LOCK ENFORCEMENT — reject writes to locked marks
            if existing.locked_at is not None:
                raise ValueError(
                    f"Mark record for student {entry.student_id}, subject {entry.subject_id}, "
                    f"exam {entry.exam_id} is locked (locked at {existing.locked_at}). "
                    "Unlock requires admin override via yearend service."
                )
            existing.theory_marks    = entry.theory_marks
            existing.practical_marks = entry.practical_marks
            existing.is_absent       = entry.is_absent
        else:
            db.add(Mark(**entry.model_dump()))

    db.commit()
    return {"saved": len(entries)}


def unlock_marks_for_year(db: Session, academic_year_id: int):
    """
    Admin override used when locked year-end marks need correction.
    Clears locked_at for all marks attached to exams in the selected year.
    """
    exam_ids = [
        row[0]
        for row in db.query(Exam.id)
        .filter(Exam.academic_year_id == academic_year_id)
        .all()
    ]
    if not exam_ids:
        return {"unlocked": 0}

    unlocked = (
        db.query(Mark)
        .filter(Mark.exam_id.in_(exam_ids), Mark.locked_at.isnot(None))
        .update({Mark.locked_at: None}, synchronize_session=False)
    )
    db.commit()
    return {"unlocked": unlocked}


def get_marks(db: Session, exam_id: int, class_id: int, subject_ids: Optional[list[int]] = None):
    exam = db.query(Exam).filter_by(id=exam_id).first()
    student_ids = []
    if exam and exam.academic_year_id:
        student_ids = [
            r[0] for r in db.query(Enrollment.student_id).filter_by(
                class_id=class_id, academic_year_id=exam.academic_year_id
            ).all()
        ]
    students = (
        db.query(Student).filter(Student.id.in_(student_ids)).all()
        if student_ids
        else db.query(Student).filter_by(class_id=class_id).filter(Student.status == StudentStatusEnum.Active).all()
    )
    subjects    = get_subjects(db, class_id)
    if subject_ids is not None:
        allowed = set(subject_ids)
        subjects = [s for s in subjects if s.id in allowed]
    subject_ids = [s.id for s in subjects]
    marks       = (
        db.query(Mark)
        .filter(Mark.exam_id == exam_id, Mark.subject_id.in_(subject_ids))
        .all()
        if subject_ids else []
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
                "is_locked": m.locked_at is not None if m else False,  # expose lock state to UI
            }
        result.append(row)

    subject_out = []
    for s in subjects:
        eff_theory, eff_practical = get_effective_max_marks(db, exam_id, s.id)
        subject_out.append({
            "id":                    s.id,
            "name":                  s.name,
            "max_theory":            eff_theory,
            "max_practical":         eff_practical,
            "default_max_theory":    s.max_theory,
            "default_max_practical": s.max_practical,
            "has_custom_config":     eff_theory != s.max_theory or eff_practical != s.max_practical,
        })

    return {"students": result, "subjects": subject_out}


def get_class_results(db: Session, exam_id: int, class_id: int):
    exam = db.query(Exam).filter_by(id=exam_id).first()
    student_ids = []
    if exam and exam.academic_year_id:
        student_ids = [
            r[0] for r in db.query(Enrollment.student_id).filter_by(
                class_id=class_id, academic_year_id=exam.academic_year_id
            ).all()
        ]
    students = (
        db.query(Student).filter(Student.id.in_(student_ids)).all()
        if student_ids
        else db.query(Student).filter_by(class_id=class_id).filter(Student.status == StudentStatusEnum.Active).all()
    )
    subjects = get_subjects(db, class_id)
    marks    = db.query(Mark).filter_by(exam_id=exam_id).all()
    mark_map = {(m.student_id, m.subject_id): m for m in marks}

    results = []
    for student in students:
        total     = Decimal("0")
        max_total = Decimal("0")
        subject_rows: list[dict] = []
        has_fail  = False

        for subject in subjects:
            eff_max_theory, eff_max_practical = get_effective_max_marks(db, exam_id, subject.id)
            max_t   = Decimal(str(eff_max_theory))
            max_p   = Decimal(str(eff_max_practical))
            max_sub = max_t + max_p
            m       = mark_map.get((student.id, subject.id))

            if not m or m.is_absent:
                theory, practical, sub_total = None, None, Decimal("0")
                grade, gp = "AB", 0.0
                has_fail  = True
            else:
                theory    = m.theory_marks    or Decimal("0")
                practical = m.practical_marks or Decimal("0")
                sub_total = theory + practical
                sub_pct   = (sub_total / max_sub * 100) if max_sub > 0 else Decimal("0")
                grade, gp, _ = get_grade(sub_pct)
                if grade == "E":
                    has_fail = True

            # Use subject's explicit passing_marks if set
            passing = None
            if hasattr(subject, "passing_marks") and subject.passing_marks:
                if sub_total is not None and sub_total < subject.passing_marks:
                    has_fail = True

            total     += sub_total if sub_total is not None else Decimal("0")
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

        percentage    = (
            (total / max_total * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if max_total > 0 else Decimal("0")
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
