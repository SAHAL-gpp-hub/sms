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
from sqlalchemy import or_, text, tuple_
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.models.base_models import (
    Subject, Exam, Mark, Student, Class, Enrollment, EnrollmentStatusEnum,
    ExamSubjectConfig,
)
from app.core.constants import CLASS_ORDER
from app.services.student_service import ensure_enrollments_for_legacy_students
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
ACTIVE_ENROLLMENT_STATUSES = (
    EnrollmentStatusEnum.active,
    EnrollmentStatusEnum.retained,
    EnrollmentStatusEnum.provisional,
)


def _resolve_mark_enrollment(db: Session, entry: MarkEntry, exam: Exam) -> Enrollment:
    if entry.enrollment_id is not None:
        enrollment = db.query(Enrollment).filter_by(id=entry.enrollment_id).first()
        if not enrollment:
            raise ValueError(f"Enrollment {entry.enrollment_id} not found")
        if enrollment.class_id != exam.class_id or enrollment.academic_year_id != exam.academic_year_id:
            raise ValueError(f"Enrollment {enrollment.id} does not belong to exam class/year")
        return enrollment
    if entry.student_id is None:
        raise ValueError("Provide enrollment_id or student_id")
    enrollment = db.query(Enrollment).filter_by(
        student_id=entry.student_id,
        class_id=exam.class_id,
        academic_year_id=exam.academic_year_id,
    ).first()
    if not enrollment:
        raise ValueError(f"Student {entry.student_id} is not enrolled for exam class {exam.class_id}")
    return enrollment


def get_grade(percentage: Decimal):
    pct = float(percentage)
    if pct > 100.0:
        raise ValueError("Percentage cannot exceed 100")
    pct = max(pct, 0.0)
    for low, high, grade, gp, remark in GSEB_GRADES:
        if pct >= low:
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

    # FIX: Validate passing_marks if provided
    max_allowed = data.max_theory + (data.max_practical or 0)
    if hasattr(data, 'passing_marks') and data.passing_marks:
        if data.passing_marks > max_allowed:
            raise ValueError(
                f"passing_marks ({data.passing_marks}) cannot exceed "
                f"max marks ({max_allowed}) for subject '{data.name}'"
            )

    if existing:
        if has_col and not existing.is_active:
            existing.is_active     = True
            existing.max_theory    = data.max_theory
            existing.max_practical = data.max_practical
            existing.subject_type  = data.subject_type
            # FIX: Also update passing_marks if provided
            if hasattr(data, 'passing_marks'):
                existing.passing_marks = data.passing_marks
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

    update_fields = data.model_dump(exclude_unset=True)

    # FIX: Validate passing_marks against (possibly updated) max marks
    new_max_theory = update_fields.get("max_theory", s.max_theory)
    new_max_practical = update_fields.get("max_practical", s.max_practical)
    new_passing = update_fields.get("passing_marks", getattr(s, "passing_marks", None))
    max_allowed = (new_max_theory or 0) + (new_max_practical or 0)
    if new_passing and new_passing > max_allowed:
        raise ValueError(
            f"passing_marks ({new_passing}) cannot exceed "
            f"max marks ({max_allowed}) for subject '{s.name}'"
        )

    for field, value in update_fields.items():
        setattr(s, field, value)

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
    ensure_enrollments_for_legacy_students(db)
    if not entries:
        return {"saved": 0}

    subject_ids = {entry.subject_id for entry in entries}
    exam_ids = {entry.exam_id for entry in entries}
    enrollment_ids = {entry.enrollment_id for entry in entries if entry.enrollment_id is not None}
    student_ids = {entry.student_id for entry in entries if entry.student_id is not None}

    subjects_by_id = {
        subject.id: subject
        for subject in db.query(Subject).filter(Subject.id.in_(subject_ids)).all()
    }
    exams_by_id = {
        exam.id: exam
        for exam in db.query(Exam).filter(Exam.id.in_(exam_ids)).all()
    }
    enrollments_by_id = {
        enrollment.id: enrollment
        for enrollment in (
            db.query(Enrollment)
            .filter(Enrollment.id.in_(enrollment_ids))
            .all()
            if enrollment_ids else []
        )
    }

    exam_class_years = {(exam.class_id, exam.academic_year_id) for exam in exams_by_id.values()}
    enrollment_query = db.query(Enrollment)
    enrollment_filters = []
    if student_ids and exam_class_years:
        enrollment_filters.append(
            tuple_(Enrollment.student_id, Enrollment.class_id, Enrollment.academic_year_id).in_(
                [
                    (student_id, class_id, academic_year_id)
                    for student_id in student_ids
                    for class_id, academic_year_id in exam_class_years
                ]
            )
        )
    if enrollment_ids:
        enrollment_filters.append(Enrollment.id.in_(enrollment_ids))
    if enrollment_filters:
        for enrollment in enrollment_query.filter(or_(*enrollment_filters)).all():
            enrollments_by_id[enrollment.id] = enrollment
    enrollments_by_student_class_year = {
        (enrollment.student_id, enrollment.class_id, enrollment.academic_year_id): enrollment
        for enrollment in enrollments_by_id.values()
    }

    configs_by_exam_subject = {
        (config.exam_id, config.subject_id): config
        for config in (
            db.query(ExamSubjectConfig)
            .filter(
                ExamSubjectConfig.exam_id.in_(exam_ids),
                ExamSubjectConfig.subject_id.in_(subject_ids),
            )
            .all()
            if exam_ids and subject_ids else []
        )
    }

    resolved_entries = []
    for entry in entries:
        subject = subjects_by_id.get(entry.subject_id)
        exam = exams_by_id.get(entry.exam_id)
        if subject is None:
            raise ValueError(f"Subject {entry.subject_id} not found")
        if exam is None:
            raise ValueError(f"Exam {entry.exam_id} not found")
        if entry.enrollment_id is not None:
            enrollment = enrollments_by_id.get(entry.enrollment_id)
            if not enrollment:
                raise ValueError(f"Enrollment {entry.enrollment_id} not found")
            if enrollment.class_id != exam.class_id or enrollment.academic_year_id != exam.academic_year_id:
                raise ValueError(f"Enrollment {enrollment.id} does not belong to exam class/year")
        else:
            if entry.student_id is None:
                raise ValueError("Provide enrollment_id or student_id")
            enrollment = enrollments_by_student_class_year.get(
                (entry.student_id, exam.class_id, exam.academic_year_id)
            )
            if not enrollment:
                raise ValueError(f"Student {entry.student_id} is not enrolled for exam class {exam.class_id}")
        if subject.class_id != exam.class_id:
            raise ValueError(f"Subject {subject.id} does not belong to exam class {exam.class_id}")

        if not entry.is_absent and entry.theory_marks is not None:
            if entry.theory_marks < 0:
                raise ValueError("Theory marks cannot be negative")
            if entry.practical_marks is not None and entry.practical_marks < 0:
                raise ValueError("Practical marks cannot be negative")

            config = configs_by_exam_subject.get((entry.exam_id, entry.subject_id))
            eff_max_theory = config.max_theory if config else subject.max_theory
            eff_max_practical = config.max_practical if config else subject.max_practical
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
        resolved_entries.append((entry, enrollment))

    mark_keys = {
        (enrollment.id, entry.subject_id, entry.exam_id)
        for entry, enrollment in resolved_entries
    }
    legacy_mark_keys = {
        (enrollment.student_id, entry.subject_id, entry.exam_id)
        for entry, enrollment in resolved_entries
    }
    existing_by_key = {
        (mark.enrollment_id, mark.subject_id, mark.exam_id): mark
        for mark in (
            db.query(Mark)
            .filter(tuple_(Mark.enrollment_id, Mark.subject_id, Mark.exam_id).in_(list(mark_keys)))
            .all()
            if mark_keys else []
        )
    }
    legacy_by_key = {
        (mark.student_id, mark.subject_id, mark.exam_id): mark
        for mark in (
            db.query(Mark)
            .filter(
                Mark.enrollment_id.is_(None),
                tuple_(Mark.student_id, Mark.subject_id, Mark.exam_id).in_(list(legacy_mark_keys)),
            )
            .all()
            if legacy_mark_keys else []
        )
    }

    for entry, enrollment in resolved_entries:
        existing = existing_by_key.get((enrollment.id, entry.subject_id, entry.exam_id))
        if not existing:
            existing = legacy_by_key.get((enrollment.student_id, entry.subject_id, entry.exam_id))
            if existing:
                existing.enrollment_id = enrollment.id
                existing_by_key[(enrollment.id, entry.subject_id, entry.exam_id)] = existing

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
            existing.student_id       = enrollment.student_id
        else:
            payload = entry.model_dump(exclude={"enrollment_id", "student_id"})
            db.add(Mark(
                **payload,
                enrollment_id=enrollment.id,
                student_id=enrollment.student_id,
            ))

    db.commit()
    db.info.pop("class_results_cache", None)
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
    enrollments = (
        db.query(Enrollment)
        .filter_by(class_id=class_id, academic_year_id=exam.academic_year_id if exam else None)
        .filter(Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
        .all()
        if exam and exam.academic_year_id else []
    )
    students = db.query(Student).filter(Student.id.in_([e.student_id for e in enrollments])).all() if enrollments else []
    enrollment_by_student = {e.student_id: e for e in enrollments}
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
    mark_map = {(m.enrollment_id, m.subject_id): m for m in marks}

    result = []
    for student in students:
        row = {
            "enrollment_id": enrollment_by_student[student.id].id,
            "student_id":   student.id,
            "student_name": student.name_en,
            "roll_number":  enrollment_by_student[student.id].roll_number,
            "marks": {},
        }
        for subject in subjects:
            m = mark_map.get((enrollment_by_student[student.id].id, subject.id))
            subject_is_locked = False           # reset each iteration
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
    """
    Computes per-student results for a given exam/class.

    Handles:
    1. Proper handling of absent vs missing marks
    2. Valid grade assignment ("NE" for not-entered, "E" for fail)
    3. Null checks in total accumulation
    4. Separate tracking of incomplete results
    5. Passing-marks override capped to the *effective* (per-exam) max marks,
       so a reduced ExamSubjectConfig max doesn't cause false fails
    6. Correct percentage handling when max_total == 0
    7. Locked marks flagging
    8. Ranking only among PASS results
    """
    cache_key = (exam_id, class_id)
    request_cache = db.info.setdefault("class_results_cache", {})
    if cache_key in request_cache:
        return request_cache[cache_key]

    exam = db.query(Exam).filter_by(id=exam_id).first()
    ensure_enrollments_for_legacy_students(db)
    enrollments = (
        db.query(Enrollment)
        .filter_by(class_id=class_id, academic_year_id=exam.academic_year_id if exam else None)
        .filter(Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
        .all()
        if exam and exam.academic_year_id else []
    )
    students = db.query(Student).filter(Student.id.in_([e.student_id for e in enrollments])).all() if enrollments else []
    enrollment_by_student = {e.student_id: e for e in enrollments}
    enrollment_ids = [e.id for e in enrollments]
    student_ids = [e.student_id for e in enrollments]
    subjects = get_subjects(db, class_id)
    subject_ids = [subject.id for subject in subjects]
    configs_by_subject = {
        config.subject_id: config
        for config in (
            db.query(ExamSubjectConfig)
            .filter(
                ExamSubjectConfig.exam_id == exam_id,
                ExamSubjectConfig.subject_id.in_(subject_ids),
            )
            .all()
            if subject_ids else []
        )
    }
    marks = (
        db.query(Mark)
        .filter(
            Mark.exam_id == exam_id,
            Mark.subject_id.in_(subject_ids) if subject_ids else False,
            or_(
                Mark.enrollment_id.in_(enrollment_ids) if enrollment_ids else False,
                Mark.enrollment_id.is_(None) & Mark.student_id.in_(student_ids) if student_ids else False,
            ),
        )
        .all()
    )
    mark_map = {(m.enrollment_id, m.subject_id): m for m in marks if m.enrollment_id is not None}
    for mark in marks:
        if mark.enrollment_id is None and mark.student_id in enrollment_by_student:
            enrollment = enrollment_by_student[mark.student_id]
            mark_map[(enrollment.id, mark.subject_id)] = mark

    results = []
    for student in students:
        total = Decimal("0")
        max_total = Decimal("0")
        subject_rows: list[dict] = []
        has_fail = False
        is_incomplete = False  # track "not entered" subjects separately
        is_locked = False      # track if any marks locked

        for subject in subjects:
            config = configs_by_subject.get(subject.id)
            eff_max_theory = config.max_theory if config else subject.max_theory
            eff_max_practical = config.max_practical if config else subject.max_practical
            max_t = Decimal(str(eff_max_theory))
            max_p = Decimal(str(eff_max_practical))
            max_sub = max_t + max_p

            # Skip subjects with no marks configured for this exam
            if max_sub == 0:
                continue

            enrollment = enrollment_by_student[student.id]
            m = mark_map.get((enrollment.id, subject.id))
            subject_is_locked = False          # ← NEW: per-subject flag

            if not m:
                theory, practical, sub_total = None, None, None
                grade, gp = "NE", 0.0
                is_incomplete = True
                total_for_subject = Decimal("0")
                max_for_subject = Decimal("0")

            elif m.is_absent:
                theory, practical, sub_total = None, None, Decimal("0")
                grade, gp, _ = get_grade(Decimal("0"))
                has_fail = True
                total_for_subject = Decimal("0")
                max_for_subject = max_sub

            # AFTER
            elif m.locked_at is not None:
                subject_is_locked = True        # per-subject only
                is_locked = True                # roll up to student level
                theory = m.theory_marks or Decimal("0")
                practical = m.practical_marks or Decimal("0")
                sub_total = theory + practical
                sub_pct = (sub_total / max_sub * 100) if max_sub > 0 else Decimal("0")
                grade, gp, _ = get_grade(sub_pct)
                if grade == "E":
                    has_fail = True             # still flag genuine fails within locked marks
                total_for_subject = sub_total
                max_for_subject = max_sub

            else:
                theory = m.theory_marks or Decimal("0")
                practical = m.practical_marks or Decimal("0")
                sub_total = theory + practical
                sub_pct = (sub_total / max_sub * 100) if max_sub > 0 else Decimal("0")
                grade, gp, _ = get_grade(sub_pct)
                if grade == "E":
                    has_fail = True
                total_for_subject = sub_total
                max_for_subject = max_sub

            # Passing-marks threshold (after grade assigned).
            #
            # IMPORTANT: cap passing_marks to the *effective* max for this
            # exam (max_sub). ExamSubjectConfig can reduce the max marks for
            # a particular exam (e.g. 25 instead of the subject default of
            # 100). Without this cap, a student scoring 18/25 (74.7%) would
            # be compared against a default passing_marks of 33/40 (set for
            # the 100-mark default) and incorrectly marked FAIL.
            passing_threshold = Decimal("0")

            if hasattr(subject, "passing_marks") and subject.passing_marks:
                # passing_marks stored as percentage (33 means 33%)
                passing_threshold = (
                    max_sub * Decimal(str(subject.passing_marks))
                ) / Decimal("100")

                if sub_total is not None and sub_total < passing_threshold:
                    has_fail = True

                    if grade not in ("NE", "AB"):
                        grade = "E"
                        gp = 0.0

            # Only accumulate if marks actually entered (or absent, which
            # counts toward max_total via max_for_subject above)
            total += total_for_subject
            max_total += max_for_subject

            subject_rows.append({
                "subject_name": subject.name,
                "max_theory": eff_max_theory,
                "max_practical": eff_max_practical,
                "theory_marks": float(theory) if theory is not None else None,
                "practical_marks": float(practical) if practical is not None else None,
                "total": float(sub_total) if sub_total is not None else None,
                "grade": grade,
                "grade_point": gp,
                "is_locked": subject_is_locked,   # ← was: is_locked (student-level, wrong)
                "is_absent": m.is_absent if m else False,
            })

        # Handle max_total = 0 (no subjects configured / no marks at all)
        if max_total == 0:
            percentage = Decimal("0")
            overall_grade = "NE"
            cgpa = 0.0
        else:
            percentage = (
                (total / max_total * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            )
            overall_grade, cgpa, _ = get_grade(percentage)

        # Result status: incomplete takes priority, then locked, then pass/fail
        if is_incomplete:
            result_str = "INCOMPLETE"
        elif is_locked:
            result_str = "LOCKED"
        else:
            result_str = "FAIL" if has_fail else "PASS"

        results.append({
            "enrollment_id": enrollment_by_student[student.id].id,
            "student_id": student.id,
            "student_name": student.name_en,
            "roll_number": enrollment_by_student[student.id].roll_number,
            "subjects": subject_rows,
            "total_marks": float(total),
            "max_marks": float(max_total),
            "percentage": float(percentage),
            "cgpa": cgpa,
            "grade": overall_grade,
            "result": result_str,
            "is_locked": is_locked,
            "is_incomplete": is_incomplete,
        })

    # Rank only among PASS results
    passed = [r for r in results if r["result"] == "PASS"]
    failed = [r for r in results if r["result"] == "FAIL"]
    incomplete = [r for r in results if r["result"] == "INCOMPLETE"]
    locked = [r for r in results if r["result"] == "LOCKED"]

    passed.sort(key=lambda x: x["percentage"], reverse=True)
    failed.sort(key=lambda x: x["percentage"], reverse=True)
    incomplete.sort(key=lambda x: x["student_name"])
    locked.sort(key=lambda x: x["student_name"])

    rank = 1
    for r in passed:
        r["class_rank"] = rank
        rank += 1
    for r in failed + incomplete + locked:
        r["class_rank"] = None

    results = passed + failed + incomplete + locked

    request_cache[cache_key] = results
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Exam name aggregation
# ─────────────────────────────────────────────────────────────────────────────

EXAM_NAME_ORDER = ["Unit Test 1", "Unit Test 2", "Half-Yearly", "Annual"]


def get_exam_names(db: Session, academic_year_id: int) -> list[str]:
    """
    Return distinct exam names for the academic year, sorted in academic order.
    Known exam types come first (Unit Test 1, Unit Test 2, Half-Yearly, Annual),
    followed by any custom/unknown exam names alphabetically.
    """
    rows = (
        db.query(Exam.name)
        .filter(Exam.academic_year_id == academic_year_id)
        .distinct()
        .all()
    )
    names = [r[0] for r in rows]
    known = [n for n in EXAM_NAME_ORDER if n in names]
    unknown = sorted(n for n in names if n not in EXAM_NAME_ORDER)
    return known + unknown