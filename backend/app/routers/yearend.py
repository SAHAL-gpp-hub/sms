"""
app/routers/yearend.py — Complete rewrite.

New vs original:
  OLD: promote (broken atomic), new-year (immediate activation), tc-pdf, current-year, years
  NEW: Every planning-doc requirement covered:

  ACADEMIC YEAR LIFECYCLE
    POST /yearend/new-year              — create DRAFT year
    POST /yearend/activate/{year_id}   — draft → active (with validation gate)
    GET  /yearend/current-year         — public
    GET  /yearend/years                — public

  PROMOTION WORKFLOW
    GET  /yearend/promote/{class_id}/validate         — preflight check
    GET  /yearend/promote/{class_id}/candidates       — per-student list
    GET  /yearend/promote/{class_id}/preview          — count summary
    POST /yearend/promote/{class_id}                  — execute (atomic)
    POST /yearend/promote/{class_id}/undo             — reverse

  YEAR-END OPERATIONS
    POST /yearend/lock-marks/{year_id}                — lock all marks
    POST /yearend/clone-fees                          — clone fee structure
    POST /yearend/clone-subjects                      — clone subjects
    POST /yearend/issue-tc/{student_id}               — issue TC

  ACADEMIC CALENDAR
    GET  /yearend/calendar/{year_id}                  — list events
    POST /yearend/calendar/{year_id}                  — add event
    PUT  /yearend/calendar/event/{event_id}           — update event
    DELETE /yearend/calendar/event/{event_id}         — delete event
    POST /yearend/calendar/{year_id}/seed-holidays    — seed standard Gujarat holidays

  DOWNLOADS (public — no auth, browser direct)
    GET  /yearend/tc-pdf/{student_id}

  AUDIT
    GET  /yearend/audit-log                           — view audit log
"""

from datetime import date as date_type, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token
from app.models.base_models import AuditLog, AcademicYear, Class, Student
from app.routers.auth import CurrentUser, require_role
from app.services import yearend_service, calendar_service
from app.services.enrollment_service import backfill_enrollments
from app.pdf.report_pdf import render_tc_pdf

router = APIRouter(prefix="/api/v1/yearend", tags=["Year-End"])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class NewYearRequest(BaseModel):
    label:      str
    start_date: str
    end_date:   str


class ActivateYearRequest(BaseModel):
    skip_validation: bool = False


class PromoteRequest(BaseModel):
    new_academic_year_id: int
    student_actions:      Optional[dict[int, str]] = None
    roll_strategy:        str = "sequential"       # sequential / alphabetical / carry_forward
    force:                bool = False


class UndoPromoteRequest(BaseModel):
    new_academic_year_id: int


class TCRequest(BaseModel):
    reason:  str = "Parent's Request"
    conduct: str = "Good"


class CalendarEventRequest(BaseModel):
    event_type:         str
    title:              str
    start_date:         date_type
    end_date:           date_type
    description:        Optional[str] = None
    affects_attendance: bool = True


class CloneRequest(BaseModel):
    from_year_id: int
    to_year_id:   int


class LockMarksRequest(BaseModel):
    academic_year_id: int


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC — no auth (browser direct downloads)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tc-pdf/{student_id}")
def download_tc(
    student_id: int,
    reason:  str = Query(default="Parent's Request"),
    conduct: str = Query(default="Good"),
    token: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Generate TC PDF using a short-lived signed download token."""
    try:
        payload = decode_access_token(token or "")
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired TC download token") from exc
    if payload.get("typ") != "pdf-download" or payload.get("resource") != f"tc:{student_id}":
        raise HTTPException(status_code=403, detail="TC download token does not match this student")
    pdf = render_tc_pdf(db, student_id, reason, conduct)
    if not pdf:
        raise HTTPException(status_code=404, detail="Student not found")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=TC_{student_id}.pdf"},
    )


@router.get("/tc-pdf-token/{student_id}")
def tc_pdf_token(
    student_id: int,
    current_user: CurrentUser = Depends(require_role("admin")),
):
    token = create_access_token(
        subject=current_user.id,
        role=current_user.role,
        expires_delta=timedelta(seconds=60),
        extra_claims={"typ": "pdf-download", "resource": f"tc:{student_id}"},
    )
    return {"token": token, "expires_in": 60, "resource": f"tc:{student_id}"}


@router.get("/current-year")
def get_current_year(db: Session = Depends(get_db)):
    year = db.query(AcademicYear).filter_by(is_current=True).first()
    if not year:
        raise HTTPException(status_code=404, detail="No current academic year set")
    return {
        "id":          year.id,
        "label":       year.label,
        "is_current":  year.is_current,
        "status":      year.status.value if hasattr(year.status, "value") else year.status,
        "start_date":  str(year.start_date),
        "end_date":    str(year.end_date),
    }


@router.get("/years")
def get_all_years(db: Session = Depends(get_db)):
    years = db.query(AcademicYear).order_by(AcademicYear.id.desc()).all()
    return [
        {
            "id":         y.id,
            "label":      y.label,
            "is_current": y.is_current,
            "is_upcoming": y.is_upcoming,
            "status":     y.status.value if hasattr(y.status, "value") else y.status,
        }
        for y in years
    ]


# ─────────────────────────────────────────────────────────────────────────────
# ACADEMIC YEAR LIFECYCLE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/new-year")
def create_new_year(
    data: NewYearRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    """
    Creates a new academic year in DRAFT status.
    Does NOT activate it. Admin must call /activate/{year_id} separately
    after configuring classes, subjects, and fee structures.
    """
    try:
        year = yearend_service.create_academic_year(
            db, data.label, data.start_date, data.end_date,
            performed_by=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "id":         year.id,
        "label":      year.label,
        "status":     year.status.value if hasattr(year.status, "value") else year.status,
        "is_current": year.is_current,
        "message":    (
            f"Academic year '{year.label}' created in DRAFT. "
            "Configure classes, subjects, and fees, then call POST /yearend/activate/{year.id}"
        ),
    }


@router.post("/activate/{year_id}")
def activate_year(
    year_id: int,
    data: ActivateYearRequest = ActivateYearRequest(),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    """
    Moves a DRAFT year to ACTIVE.
    Validates that classes, fee structures, and subjects are configured.
    Previous active year is automatically closed.
    """
    try:
        result = yearend_service.activate_academic_year(
            db, year_id,
            performed_by=current_user.id,
            skip_validation=data.skip_validation,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


# ─────────────────────────────────────────────────────────────────────────────
# PROMOTION WORKFLOW
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/promote/{class_id}/validate")
def validate_promotion(
    class_id:             int,
    new_academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Preflight check. Returns errors (blocking) and warnings (advisory).
    Call this before showing the promotion UI to the admin.
    """
    return yearend_service.validate_pre_promotion(db, class_id, new_academic_year_id)


@router.get("/promote/{class_id}/candidates")
def get_candidates(
    class_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Per-student candidate list for admin review.
    Each student includes: name, exam result, pending dues, attendance %, suggested action.
    Admin uses this to set student_actions before calling POST /promote/{class_id}.
    """
    current_class = db.query(Class).filter_by(id=class_id).first()
    if not current_class:
        raise HTTPException(status_code=404, detail="Class not found")
    return {
        "class_name": current_class.name,
        "division":   current_class.division,
        "candidates": yearend_service.generate_candidate_list(db, class_id),
    }


@router.get("/promote/{class_id}/preview")
def preview_promotion(
    class_id:             int,
    new_academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Summary count preview (validate + candidate counts in one call).
    Shows promoted/retained/graduating/excluded breakdown.
    """
    validation = yearend_service.validate_pre_promotion(db, class_id, new_academic_year_id)
    candidates = yearend_service.generate_candidate_list(db, class_id)

    summary = {
        "promoted":    sum(1 for c in candidates if c["suggested_action"] == "promoted"),
        "retained":    sum(1 for c in candidates if c["suggested_action"] == "retained"),
        "graduated":   sum(1 for c in candidates if c["suggested_action"] == "graduated"),
        "on_hold":     sum(1 for c in candidates if c["suggested_action"] == "on_hold"),
        "with_dues":   sum(1 for c in candidates if c["flags"]["has_pending_dues"]),
        "low_att":     sum(1 for c in candidates if c["flags"]["low_attendance"]),
        "no_marks":    sum(1 for c in candidates if c["flags"]["no_marks_entered"]),
    }

    current_class = db.query(Class).filter_by(id=class_id).first()

    return {
        "class_name":            current_class.name if current_class else "—",
        "division":              current_class.division if current_class else "—",
        "new_academic_year_id":  new_academic_year_id,
        "validation":            validation,
        "candidate_summary":     summary,
        "total_candidates":      len(candidates),
        "ready_to_promote":      validation["can_proceed"],
    }


@router.post("/promote/{class_id}")
def promote_class(
    class_id: int,
    data: PromoteRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    """
    Execute bulk promotion. Atomic — full rollback on any error.
    
    student_actions: optional dict of {student_id: action} overrides.
    Actions: promoted / retained / graduated / transferred / dropped / on_hold
    
    If not provided, auto-detects from exam results.
    """
    try:
        result = yearend_service.bulk_promote_students(
            db,
            class_id             = class_id,
            new_academic_year_id = data.new_academic_year_id,
            performed_by         = current_user.id,
            student_actions      = data.student_actions,
            roll_strategy        = data.roll_strategy,
            force                = data.force,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result


@router.post("/promote/{class_id}/undo")
def undo_promotion(
    class_id: int,
    data: UndoPromoteRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    """
    Reverses a promotion for a class.
    Only allowed before the target year is activated (status=draft).
    """
    try:
        result = yearend_service.undo_promotion(
            db,
            class_id             = class_id,
            new_academic_year_id = data.new_academic_year_id,
            performed_by         = current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


# ─────────────────────────────────────────────────────────────────────────────
# YEAR-END OPERATIONS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/lock-marks")
def lock_marks(
    data: LockMarksRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    """
    Locks all exam marks for a given academic year.
    After locking, marks cannot be edited (enforced at application layer).
    Run this before bulk promotion.
    """
    try:
        result = yearend_service.lock_marks_for_year(
            db, data.academic_year_id, performed_by=current_user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


@router.post("/clone-fees")
def clone_fees(
    data: CloneRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    """
    Copies all fee structures from one year to another.
    Useful at year start — clone last year's fees, then adjust amounts.
    """
    try:
        result = yearend_service.clone_fee_structure(
            db, data.from_year_id, data.to_year_id, performed_by=current_user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


@router.post("/clone-subjects")
def clone_subjects(
    data: CloneRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    """
    Copies all active subjects from one year's classes to the next year's
    matching classes (matched by name + division).
    """
    try:
        result = yearend_service.clone_subjects(
            db, data.from_year_id, data.to_year_id, performed_by=current_user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


@router.post("/issue-tc/{student_id}")
def issue_tc(
    student_id: int,
    data: TCRequest = TCRequest(),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    student = yearend_service.issue_tc(db, student_id, reason=data.reason)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return {
        "message": f"TC issued for {student.name_en}",
        "status":  student.status.value if hasattr(student.status, "value") else student.status,
    }


@router.post("/backfill-enrollments")
def backfill_enrollments_endpoint(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    One-time migration: creates Enrollment rows for all existing Students.
    Safe to call multiple times (idempotent).
    Run this once after deploying the new schema.
    """
    result = backfill_enrollments(db)
    return {**result, "message": "Enrollment backfill complete. Existing students now have enrollment records."}


# ─────────────────────────────────────────────────────────────────────────────
# ACADEMIC CALENDAR
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/calendar/{year_id}")
def list_calendar_events(
    year_id:    int,
    event_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "teacher")),
):
    events = calendar_service.list_events(db, year_id, event_type)
    return [
        {
            "id":                 e.id,
            "event_type":         e.event_type.value if hasattr(e.event_type, "value") else e.event_type,
            "title":              e.title,
            "start_date":         str(e.start_date),
            "end_date":           str(e.end_date),
            "description":        e.description,
            "affects_attendance": e.affects_attendance,
        }
        for e in events
    ]


@router.post("/calendar/{year_id}", status_code=201)
def add_calendar_event(
    year_id: int,
    data: CalendarEventRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    if data.end_date < data.start_date:
        raise HTTPException(status_code=422, detail="end_date must be >= start_date")
    event = calendar_service.create_event(
        db,
        academic_year_id   = year_id,
        event_type         = data.event_type,
        title              = data.title,
        start_date         = data.start_date,
        end_date           = data.end_date,
        description        = data.description,
        affects_attendance = data.affects_attendance,
    )
    return {
        "id":                 event.id,
        "event_type":         event.event_type.value if hasattr(event.event_type, "value") else event.event_type,
        "title":              event.title,
        "start_date":         str(event.start_date),
        "end_date":           str(event.end_date),
        "affects_attendance": event.affects_attendance,
    }


@router.put("/calendar/event/{event_id}")
def update_calendar_event(
    event_id: int,
    data: CalendarEventRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    event = calendar_service.update_event(
        db, event_id,
        event_type=data.event_type,
        title=data.title,
        start_date=data.start_date,
        end_date=data.end_date,
        description=data.description,
        affects_attendance=data.affects_attendance,
    )
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    return {"id": event.id, "title": event.title, "message": "Updated"}


@router.delete("/calendar/event/{event_id}")
def delete_calendar_event(
    event_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    deleted = calendar_service.delete_event(db, event_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    return {"message": "Deleted"}


@router.post("/calendar/{year_id}/seed-holidays")
def seed_holidays(
    year_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """Seeds standard Gujarat school holidays for 2025-26."""
    count = calendar_service.seed_standard_holidays(db, year_id)
    return {"seeded": count, "message": f"Seeded {count} holiday events for year {year_id}"}


# ─────────────────────────────────────────────────────────────────────────────
# AUDIT LOG
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/audit-log")
def get_audit_log(
    operation:        Optional[str] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    limit:            int           = Query(50, ge=1, le=200),
    offset:           int           = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Returns audit log entries for bulk operations.
    Filterable by operation type and academic year.
    """
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if operation:
        q = q.filter(AuditLog.operation == operation)
    if academic_year_id:
        q = q.filter(AuditLog.academic_year_id == academic_year_id)

    total = q.count()
    logs  = q.offset(offset).limit(limit).all()

    return {
        "total": total,
        "logs": [
            {
                "id":               log.id,
                "operation":        log.operation.value if hasattr(log.operation, "value") else log.operation,
                "performed_by":     log.performed_by,
                "academic_year_id": log.academic_year_id,
                "class_id":         log.class_id,
                "affected_count":   log.affected_count,
                "result":           log.result,
                "error_detail":     log.error_detail,
                "created_at":       str(log.created_at),
                "payload":          log.payload,
            }
            for log in logs
        ],
    }
