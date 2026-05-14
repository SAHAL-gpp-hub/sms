# backend/app/routers/portal.py
"""
S10 — Student & Parent Portal convenience endpoints.

These are thin wrappers around existing data, automatically scoped to the
logged-in user's linked student. No new DB tables needed — S9 RBAC handles
access control.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.models.base_models import ProfileCorrectionRequest, Student, Class, AcademicYear, Attendance, Exam
from app.routers.auth import CurrentUser, require_role
from app.services import fee_service, attendance_service, marks_service, report_card_service
from app.services.calendar_service import count_working_days_for_month
from app.core.config import settings
from app.pdf.marksheet_pdf import render_marksheet_pdf

router = APIRouter(prefix="/api/v1/portal", tags=["Portal"])

CORRECTION_FIELDS = {
    "name_en", "name_gu", "dob", "contact", "address",
    "father_name", "mother_name", "guardian_email", "guardian_phone",
}


class CorrectionRequestCreate(BaseModel):
    student_id: Optional[int] = None
    field_name: str
    requested_value: str = Field(min_length=1, max_length=500)
    reason: Optional[str] = Field(default=None, max_length=500)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_student_id(
    user: CurrentUser,
    student_id: Optional[int] = None,
) -> int:
    """
    For student role  → always returns linked_student_id.
    For parent role   → returns student_id param (must be in linked list),
                        or first linked child if no param given.
    Raises 404 if nothing linked, 403 if parent tries to access unlinked child.
    """
    if user.role == "student":
        if user.linked_student_id is None:
            raise HTTPException(404, "No student record linked to your account. Contact admin.")
        return user.linked_student_id

    # parent
    if not user.linked_student_ids:
        raise HTTPException(404, "No student records linked to your account. Contact admin.")

    if student_id is not None:
        if student_id not in user.linked_student_ids:
            raise HTTPException(403, "You do not have access to this student.")
        return student_id

    return user.linked_student_ids[0]


# ── /portal/me/* (student + parent) ──────────────────────────────────────────

@router.get("/me/profile")
def get_my_profile(
    student_id: Optional[int] = Query(None),
    user: CurrentUser = Depends(require_role("student", "parent")),
    db: Session = Depends(get_db),
):
    sid = _resolve_student_id(user, student_id)
    student = db.query(Student).filter_by(id=sid).first()
    if not student:
        raise HTTPException(404, "Student record not found")
    cls = db.query(Class).filter_by(id=student.class_id).first() if student.class_id else None
    class_label = f"Class {cls.name} — {cls.division}" if cls else None
    return {
        "id":               student.id,
        "student_id":       student.student_id,
        "gr_number":        student.gr_number,
        "name_en":          student.name_en,
        "name_gu":          student.name_gu,
        "dob":              str(student.dob) if student.dob else None,
        "gender":           student.gender,
        "class_id":         student.class_id,
        "class_label":      class_label,
        "roll_number":      student.roll_number,
        "father_name":      student.father_name,
        "mother_name":      student.mother_name,
        "contact":          student.contact,
        "address":          student.address,
        "category":         student.category,
        "admission_date":   str(student.admission_date) if student.admission_date else None,
        "academic_year_id": student.academic_year_id,
        "status":           student.status,
    }


@router.get("/me/results")
def get_my_results(
    student_id: Optional[int] = Query(None),
    user: CurrentUser = Depends(require_role("student", "parent")),
    db: Session = Depends(get_db),
):
    """All exam results across all exams, latest first."""
    sid = _resolve_student_id(user, student_id)
    student = db.query(Student).filter_by(id=sid).first()
    if not student:
        raise HTTPException(404, "Student record not found")

    exams = db.query(Exam).filter_by(class_id=student.class_id).all()

    all_results = []
    for exam in exams:
        try:
            results = marks_service.get_class_results(db, exam.id, student.class_id)
            match = next((r for r in results if r["student_id"] == sid), None)
            if match:
                match["exam_id"] = exam.id
                match["name"]    = exam.name
                match["exam_date"] = str(exam.exam_date) if exam.exam_date else None
                all_results.append(match)
        except Exception:
            continue

    # Sort by exam_date descending (None last)
    all_results.sort(
        key=lambda x: x.get("exam_date") or "0000",
        reverse=True,
    )
    return all_results


@router.get("/me/attendance")
def get_my_attendance(
    student_id: Optional[int] = Query(None),
    user: CurrentUser = Depends(require_role("student", "parent")),
    db: Session = Depends(get_db),
):
    """Last 3 months daily attendance records."""
    from datetime import date, timedelta

    sid = _resolve_student_id(user, student_id)
    student = db.query(Student).filter_by(id=sid).first()
    if not student:
        raise HTTPException(404, "Student record not found")

    cutoff = date.today() - timedelta(days=92)  # ~3 months
    records = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == sid,
            Attendance.date >= cutoff,
        )
        .order_by(Attendance.date.desc())
        .all()
    )
    return [{"date": str(r.date), "status": r.status} for r in records]


@router.get("/me/attendance/summary")
def get_my_attendance_summary(
    student_id: Optional[int] = Query(None),
    months: int = Query(3),
    user: CurrentUser = Depends(require_role("student", "parent")),
    db: Session = Depends(get_db),
):
    """Monthly attendance % per month for last N months."""
    from datetime import date, timedelta
    from calendar import monthrange

    sid = _resolve_student_id(user, student_id)
    student = db.query(Student).filter_by(id=sid).first()
    if not student:
        raise HTTPException(404, "Student record not found")

    today = date.today()
    summaries = []

    for i in range(months):
        # Walk back month by month
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1

        _, days_in_month = monthrange(y, m)
        month_start = date(y, m, 1)
        month_end   = date(y, m, days_in_month)

        working_days = count_working_days_for_month(db, student.academic_year_id, y, m)

        records = (
            db.query(Attendance)
            .filter(
                Attendance.student_id == sid,
                Attendance.date >= month_start,
                Attendance.date <= month_end,
            )
            .all()
        )

        present    = sum(1 for r in records if r.status == "P")
        absent     = sum(1 for r in records if r.status == "A")
        late       = sum(1 for r in records if r.status == "L")
        effective_present = present + (late if settings.LATE_COUNTS_AS_PRESENT else 0)
        percentage = round((effective_present / working_days * 100), 1) if working_days > 0 else 0

        summaries.append({
            "year":         y,
            "month":        m,
            "month_name":   month_start.strftime("%B %Y"),
            "working_days": working_days,
            "present":      present,
            "absent":       absent,
            "late":         late,
            "percentage":   percentage,
            "low_attendance": percentage < 75,
        })

    return summaries


@router.get("/me/fees")
def get_my_fees(
    student_id: Optional[int] = Query(None),
    user: CurrentUser = Depends(require_role("student", "parent")),
    db: Session = Depends(get_db),
):
    """Full fee ledger (dues, paid, outstanding balance)."""
    sid = _resolve_student_id(user, student_id)
    ledger = fee_service.get_student_ledger(db, sid)
    if not ledger:
        raise HTTPException(404, "No fee records found for this student")
    return ledger


@router.get("/me/marksheet/{exam_id}")
def get_my_marksheet(
    exam_id: int,
    student_id: Optional[int] = Query(None),
    user: CurrentUser = Depends(require_role("student", "parent")),
    db: Session = Depends(get_db),
):
    """Trigger PDF download for linked student."""
    sid = _resolve_student_id(user, student_id)
    student = db.query(Student).filter_by(id=sid).first()
    if not student:
        raise HTTPException(404, "Student record not found")

    pdf = render_marksheet_pdf(db, exam_id, student.class_id, sid)
    if not pdf:
        raise HTTPException(404, "No marks found for this exam")
    report_card_service.upsert_report_card(
        db,
        student_id=sid,
        exam_id=exam_id,
        pdf_path=f"/api/v1/portal/me/marksheet/{exam_id}?student_id={sid}",
    )


@router.post("/correction-requests")
def create_correction_request(
    data: CorrectionRequestCreate,
    user: CurrentUser = Depends(require_role("student", "parent")),
    db: Session = Depends(get_db),
):
    if data.field_name not in CORRECTION_FIELDS:
        raise HTTPException(422, "This profile field cannot be changed from the portal")
    sid = _resolve_student_id(user, data.student_id)
    student = db.query(Student).filter_by(id=sid).first()
    if not student:
        raise HTTPException(404, "Student record not found")
    current_value = getattr(student, data.field_name, None)
    req = ProfileCorrectionRequest(
        student_id=sid,
        requested_by_user_id=user.id,
        field_name=data.field_name,
        current_value=str(current_value) if current_value is not None else None,
        requested_value=data.requested_value.strip(),
        reason=data.reason.strip() if data.reason else None,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {
        "id": req.id,
        "status": req.status,
        "field_name": req.field_name,
        "current_value": req.current_value,
        "requested_value": req.requested_value,
        "created_at": req.created_at,
    }
    db.commit()

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=marksheet_{student.student_id}_{exam_id}.pdf"
        },
    )


# ── /portal/me/children/* (parent with multiple children) ────────────────────

@router.get("/me/children")
def get_my_children(
    user: CurrentUser = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    """List all linked student records for a parent."""
    if not user.linked_student_ids:
        return []

    children = db.query(Student).filter(
        Student.id.in_(user.linked_student_ids)
    ).all()
    class_lookup = {
        c.id: f"Class {c.name} — {c.division}"
        for c in db.query(Class).filter(Class.id.in_([s.class_id for s in children if s.class_id])).all()
    }

    return [
        {
            "id":         s.id,
            "student_id": s.student_id,
            "name_en":    s.name_en,
            "name_gu":    s.name_gu,
            "class_id":   s.class_id,
            "class_label": class_lookup.get(s.class_id),
            "roll_number":s.roll_number,
            "status":     s.status,
        }
        for s in children
    ]


@router.get("/me/children/{sid}/profile")
def get_child_profile(
    sid: int,
    user: CurrentUser = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    if sid not in user.linked_student_ids:
        raise HTTPException(403, "You do not have access to this student")
    # Reuse the me/profile logic
    return get_my_profile(student_id=sid, user=user, db=db)


@router.get("/me/children/{sid}/results")
def get_child_results(
    sid: int,
    user: CurrentUser = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    if sid not in user.linked_student_ids:
        raise HTTPException(403, "You do not have access to this student")
    return get_my_results(student_id=sid, user=user, db=db)


@router.get("/me/children/{sid}/fees")
def get_child_fees(
    sid: int,
    user: CurrentUser = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    if sid not in user.linked_student_ids:
        raise HTTPException(403, "You do not have access to this student")
    return get_my_fees(student_id=sid, user=user, db=db)


@router.get("/me/children/{sid}/attendance")
def get_child_attendance(
    sid: int,
    user: CurrentUser = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    if sid not in user.linked_student_ids:
        raise HTTPException(403, "You do not have access to this student")
    return get_my_attendance(student_id=sid, user=user, db=db)
