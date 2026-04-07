from sqlalchemy.orm import Session
from app.models.base_models import Subject, Exam, Mark, Student, Class
from app.schemas.marks import SubjectCreate, ExamCreate, MarkEntry
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

# ── GSEB Grading ──────────────────────────────────────────

GSEB_GRADES = [
    (91, 100, "A1", Decimal("10.0"), "Outstanding"),
    (81, 90,  "A2", Decimal("9.0"),  "Excellent"),
    (71, 80,  "B1", Decimal("8.0"),  "Very Good"),
    (61, 70,  "B2", Decimal("7.0"),  "Good"),
    (51, 60,  "C1", Decimal("6.0"),  "Average"),
    (41, 50,  "C2", Decimal("5.0"),  "Satisfactory"),
    (33, 40,  "D",  Decimal("4.0"),  "Pass"),
    (0,  32,  "E",  Decimal("0.0"),  "Fail"),
]

def get_grade(percentage: Decimal):
    pct = float(percentage)
    for low, high, grade, gp, remark in GSEB_GRADES:
        if low <= pct <= high:
            return grade, gp, remark
    return "E", Decimal("0.0"), "Fail"

def percentage_to_cgpa(percentage: Decimal) -> Decimal:
    _, gp, _ = get_grade(percentage)
    return gp

# ── Pre-loaded GSEB Subject Sets ──────────────────────────

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

def seed_subjects(db: Session, class_id: int):
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
                subject_type="Theory+Practical" if max_practical > 0 else "Theory"
            ))
            count += 1
    db.commit()
    return count

# ── Subjects ──────────────────────────────────────────────

def get_subjects(db: Session, class_id: int):
    return db.query(Subject).filter_by(class_id=class_id).all()

def create_subject(db: Session, data: SubjectCreate):
    s = Subject(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

def delete_subject(db: Session, subject_id: int):
    s = db.query(Subject).filter_by(id=subject_id).first()
    if s:
        db.delete(s)
        db.commit()
    return s

# ── Exams ─────────────────────────────────────────────────

def get_exams(db: Session, class_id: int = None, academic_year_id: int = None):
    q = db.query(Exam)
    if class_id:
        q = q.filter_by(class_id=class_id)
    if academic_year_id:
        q = q.filter_by(academic_year_id=academic_year_id)
    return q.all()

def create_exam(db: Session, data: ExamCreate):
    e = Exam(**data.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return e

def delete_exam(db: Session, exam_id: int):
    e = db.query(Exam).filter_by(id=exam_id).first()
    if e:
        db.delete(e)
        db.commit()
    return e

# ── Marks ─────────────────────────────────────────────────

def bulk_save_marks(db: Session, entries: list[MarkEntry]):
    for entry in entries:
        existing = db.query(Mark).filter_by(
            student_id=entry.student_id,
            subject_id=entry.subject_id,
            exam_id=entry.exam_id
        ).first()
        if existing:
            existing.theory_marks = entry.theory_marks
            existing.practical_marks = entry.practical_marks
            existing.is_absent = entry.is_absent
        else:
            db.add(Mark(**entry.model_dump()))
    db.commit()
    return {"saved": len(entries)}

def get_marks(db: Session, exam_id: int, class_id: int):
    students = db.query(Student).filter_by(class_id=class_id).all()
    subjects = db.query(Subject).filter_by(class_id=class_id).all()
    marks = db.query(Mark).filter_by(exam_id=exam_id).all()

    mark_map = {(m.student_id, m.subject_id): m for m in marks}

    result = []
    for student in students:
        row = {"student_id": student.id, "student_name": student.name_en, "roll_number": student.roll_number, "marks": {}}
        for subject in subjects:
            m = mark_map.get((student.id, subject.id))
            row["marks"][subject.id] = {
                "theory": float(m.theory_marks) if m and m.theory_marks is not None else None,
                "practical": float(m.practical_marks) if m and m.practical_marks is not None else None,
                "is_absent": m.is_absent if m else False,
            }
        result.append(row)
    return {"students": result, "subjects": [{"id": s.id, "name": s.name, "max_theory": s.max_theory, "max_practical": s.max_practical} for s in subjects]}

# ── Results ───────────────────────────────────────────────

def get_class_results(db: Session, exam_id: int, class_id: int):
    students = db.query(Student).filter_by(class_id=class_id).all()
    subjects = db.query(Subject).filter_by(class_id=class_id).all()
    marks = db.query(Mark).filter_by(exam_id=exam_id).all()
    mark_map = {(m.student_id, m.subject_id): m for m in marks}

    results = []
    for student in students:
        total = Decimal("0")
        max_total = Decimal("0")
        subject_rows = []
        has_fail = False

        for subject in subjects:
            m = mark_map.get((student.id, subject.id))
            max_t = Decimal(str(subject.max_theory))
            max_p = Decimal(str(subject.max_practical))
            max_sub = max_t + max_p

            if not m or m.is_absent:
                theory, practical, sub_total = None, None, Decimal("0")
                sub_pct = Decimal("0")
                grade, gp = "AB", Decimal("0")
                has_fail = True
            else:
                theory = m.theory_marks or Decimal("0")
                practical = m.practical_marks or Decimal("0")
                sub_total = theory + practical
                sub_pct = (sub_total / max_sub * 100) if max_sub > 0 else Decimal("0")
                grade_str, gp, _ = get_grade(sub_pct)
                grade = grade_str
                if grade == "E":
                    has_fail = True

            total += sub_total if sub_total else Decimal("0")
            max_total += max_sub
            subject_rows.append({
                "subject_name": subject.name,
                "max_theory": subject.max_theory,
                "max_practical": subject.max_practical,
                "theory_marks": float(theory) if theory is not None else None,
                "practical_marks": float(practical) if practical is not None else None,
                "total": float(sub_total),
                "grade": grade,
                "grade_point": float(gp),
            })

        percentage = (total / max_total * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if max_total > 0 else Decimal("0")
        overall_grade, cgpa, _ = get_grade(percentage)
        result_str = "FAIL" if has_fail else "PASS"

        results.append({
            "student_id": student.id,
            "student_name": student.name_en,
            "roll_number": student.roll_number,
            "subjects": subject_rows,
            "total_marks": float(total),
            "max_marks": float(max_total),
            "percentage": float(percentage),
            "cgpa": float(cgpa),
            "grade": overall_grade,
            "result": result_str,
        })

    # Assign class rank by percentage
    results.sort(key=lambda x: x["percentage"], reverse=True)
    for i, r in enumerate(results):
        r["class_rank"] = i + 1

    return results