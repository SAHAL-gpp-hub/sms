"""PDF download routes guarded by short-lived signed URL tokens."""

import logging
from datetime import timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import SessionLocal, get_db
from app.core.security import create_access_token, decode_access_token
from app.models.base_models import Enrollment, FeePayment, StudentFee
from app.routers.auth import CurrentUser, ensure_class_access, ensure_student_access, require_role
from app.pdf import job_store
from app.pdf.marksheet_pdf import render_marksheet_pdf
from app.pdf.report_pdf import (
    render_fee_receipt_pdf,
    render_defaulter_report,
    render_attendance_report,
    render_result_report
)
from app.services import report_card_service

logger = logging.getLogger("sms.pdf.router")

router = APIRouter(prefix="/api/v1/pdf", tags=["PDF"])

# How long (seconds) a one-shot PDF download token is valid.
# Class marksheets can take 10-20 s to render, so the token window must be
# longer than that to avoid the frontend re-requesting a token mid-poll.
_PDF_TOKEN_TTL = 120  # 2 minutes


def _require_pdf_token(token: str | None, resource: str) -> None:
    if not token:
        raise HTTPException(status_code=401, detail="PDF download token is required")
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired PDF download token") from exc
    if payload.get("typ") != "pdf-download" or payload.get("resource") != resource:
        raise HTTPException(status_code=403, detail="PDF download token does not match this resource")


def _pdf_token(current_user: CurrentUser, resource: str, ttl: int = _PDF_TOKEN_TTL) -> dict:
    token = create_access_token(
        subject=current_user.id,
        role=current_user.role,
        expires_delta=timedelta(seconds=ttl),
        extra_claims={"typ": "pdf-download", "resource": resource},
    )
    return {"token": token, "expires_in": ttl, "resource": resource}


def create_receipt_download_token(payment_id: int, expires_seconds: int = 3600 * 24 * 30) -> str:
    return create_access_token(
        subject=f"payment:{payment_id}",
        role="receipt",
        expires_delta=timedelta(seconds=expires_seconds),
        extra_claims={"typ": "pdf-download", "resource": f"receipt:{payment_id}"},
    )


# ── Token endpoints ────────────────────────────────────────────────────────────

@router.get("/token/marksheet/student/{student_id}")
def student_marksheet_token(
    student_id: int,
    exam_id: int = Query(...),
    class_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher", "student", "parent")),
):
    ensure_student_access(db, current_user, student_id)
    if current_user.role == "teacher":
        ensure_class_access(current_user, class_id)
    return _pdf_token(current_user, f"marksheet:student:{student_id}:exam:{exam_id}:class:{class_id}")


@router.get("/token/marksheet/class/{class_id}")
def class_marksheet_token(
    class_id: int,
    exam_id: int = Query(...),
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    ensure_class_access(current_user, class_id)
    return _pdf_token(current_user, f"marksheet:class:{class_id}:exam:{exam_id}")


@router.get("/token/report/defaulters")
def defaulter_report_token(
    academic_year_id: Optional[int] = Query(None),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    return _pdf_token(current_user, f"report:defaulters:{academic_year_id or 'all'}")


@router.get("/token/report/attendance")
def attendance_report_token(
    class_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    ensure_class_access(current_user, class_id)
    return _pdf_token(current_user, f"report:attendance:{class_id}:{year}:{month}")


@router.get("/token/report/results")
def result_report_token(
    exam_id: int = Query(...),
    class_id: int = Query(...),
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    ensure_class_access(current_user, class_id)
    return _pdf_token(current_user, f"report:results:{exam_id}:{class_id}")


@router.get("/token/receipt/{payment_id}")
def fee_receipt_token(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "student", "parent")),
):
    # Consolidate into a single joined query instead of 3 sequential ones.
    row = (
        db.query(FeePayment, StudentFee, Enrollment)
        .join(StudentFee, StudentFee.id == FeePayment.student_fee_id)
        .outerjoin(Enrollment, Enrollment.id == StudentFee.enrollment_id)
        .filter(FeePayment.id == payment_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment, student_fee, enrollment = row
    if not student_fee:
        raise HTTPException(status_code=404, detail="Payment record is invalid")
    student_id = student_fee.student_id or (enrollment.student_id if enrollment else None)
    if not student_id:
        raise HTTPException(status_code=404, detail="Payment student is invalid")
    ensure_student_access(db, current_user, student_id)
    return _pdf_token(current_user, f"receipt:{payment_id}")


# ── PDF download endpoints ─────────────────────────────────────────────────────

@router.get("/marksheet/student/{student_id}")
def generate_student_marksheet(
    student_id: int,
    exam_id: int = Query(...),
    class_id: int = Query(...),
    token: str | None = Query(None),
    db: Session = Depends(get_db)
):
    _require_pdf_token(token, f"marksheet:student:{student_id}:exam:{exam_id}:class:{class_id}")
    pdf = render_marksheet_pdf(db, exam_id, class_id, student_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="No marks found for this student")
    report_card_service.upsert_report_card(
        db,
        student_id=student_id,
        exam_id=exam_id,
        # Store a path relative to the API root (no leading /api/v1) so the
        # frontend can build the full URL with its own base URL.
        pdf_path=f"/pdf/marksheet/student/{student_id}?exam_id={exam_id}&class_id={class_id}",
    )
    db.commit()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=marksheet_{student_id}.pdf"}
    )


@router.get("/marksheet/class/{class_id}")
def generate_class_marksheet(
    class_id: int,
    exam_id: int = Query(...),
    token: str | None = Query(None),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    """Kick off a class marksheet as a background job and return a poll URL.

    A full-class marksheet (40 students) can take 10-20 s to render even when
    parallelised — too long for a synchronous HTTP request that browsers or
    proxies may time out. The client polls GET /marksheet/class/{id}/status/{jid}
    until the PDF is ready, then navigates directly to it.

    Returns JSON: { job_id, status, poll_url, retry_after_ms }
    poll_url is intentionally path-only (no /api/v1 prefix) so the frontend
    Axios instance can prepend its configured baseURL without doubling it.
    """
    _require_pdf_token(token, f"marksheet:class:{class_id}:exam:{exam_id}")
    jid = job_store.create_job()

    def _run():
        # Use a fresh DB session — BackgroundTasks run after the request
        # session has already been closed by the get_db dependency.
        with SessionLocal() as job_db:
            try:
                pdf = render_marksheet_pdf(job_db, exam_id, class_id)
                if not pdf:
                    job_store.set_error(jid, "No marks found for this class")
                    return
                report_card_service.upsert_class_report_cards(
                    job_db, class_id=class_id, exam_id=exam_id
                )
                job_db.commit()
                job_store.set_done(jid, pdf)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Class marksheet job %s failed", jid)
                job_store.set_error(jid, str(exc))

    if background_tasks is not None:
        background_tasks.add_task(_run)
    else:  # defensive — FastAPI always injects BackgroundTasks
        _run()

    # FIX: poll_url must NOT include the /api/v1 prefix.
    # The frontend Axios instance already has baseURL="/api/v1", so prepending
    # it here would produce /api/v1/api/v1/... (404 loop seen in logs).
    return JSONResponse({
        "job_id": jid,
        "status": "pending",
        "poll_url": f"/pdf/marksheet/class/{class_id}/status/{jid}",
        # Hint to the frontend: wait at least this long before the first poll.
        # Prevents the tight 1-second retry loop visible in logs.
        "retry_after_ms": 2000,
    })


@router.get("/marksheet/class/{class_id}/status/{job_id}")
def class_marksheet_status(class_id: int, job_id: str):
    """Poll a class marksheet job. Returns pending JSON, the PDF, or an error.

    Pending response includes retry_after_ms so the frontend can implement
    sensible exponential backoff instead of hammering every second.
    """
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] == "done":
        pdf = job["pdf"]
        job_store.cleanup(job_id)  # free in-process memory once delivered
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=marksheet_class_{class_id}.pdf",
                "Cache-Control": "no-store",
            },
        )

    if job["status"] == "error":
        job_store.cleanup(job_id)
        raise HTTPException(status_code=500, detail=job["error"])

    # Still pending — tell the client how long to wait before polling again.
    return JSONResponse(
        {"status": "pending", "job_id": job_id, "retry_after_ms": 2000},
        status_code=202,
    )


# ── Report endpoints ───────────────────────────────────────────────────────────

@router.get("/report/defaulters")
def defaulter_report(
    academic_year_id: Optional[int] = Query(None),
    token: str | None = Query(None),
    db: Session = Depends(get_db)
):
    _require_pdf_token(token, f"report:defaulters:{academic_year_id or 'all'}")
    pdf = render_defaulter_report(db, academic_year_id)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=defaulter_report.pdf"}
    )


@router.get("/report/attendance")
def attendance_report(
    class_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    token: str | None = Query(None),
    db: Session = Depends(get_db)
):
    _require_pdf_token(token, f"report:attendance:{class_id}:{year}:{month}")
    pdf = render_attendance_report(db, class_id, year, month)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=attendance_report.pdf"}
    )


@router.get("/report/results")
def result_report(
    exam_id: int = Query(...),
    class_id: int = Query(...),
    token: str | None = Query(None),
    db: Session = Depends(get_db)
):
    _require_pdf_token(token, f"report:results:{exam_id}:{class_id}")
    pdf = render_result_report(db, exam_id, class_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="No marks found for this class")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=result_report.pdf"}
    )


@router.get("/receipt/{payment_id}")
def fee_receipt_pdf(
    payment_id: int,
    token: str | None = Query(None),
    db: Session = Depends(get_db),
):
    _require_pdf_token(token, f"receipt:{payment_id}")
    pdf = render_fee_receipt_pdf(db, payment_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="Payment receipt not found")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=receipt_{payment_id}.pdf"},
    )