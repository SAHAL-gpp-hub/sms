"""PDF download routes guarded by short-lived signed URL tokens."""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token
from app.models.base_models import FeePayment, StudentFee
from app.routers.auth import CurrentUser, ensure_class_access, ensure_student_access, require_role
from app.pdf.marksheet_pdf import render_marksheet_pdf
from app.pdf.report_pdf import (
    render_fee_receipt_pdf,
    render_defaulter_report,
    render_attendance_report,
    render_result_report
)
from app.services import report_card_service

router = APIRouter(prefix="/api/v1/pdf", tags=["PDF"])


def _require_pdf_token(token: str | None, resource: str) -> None:
    if not token:
        raise HTTPException(status_code=401, detail="PDF download token is required")
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired PDF download token") from exc
    if payload.get("typ") != "pdf-download" or payload.get("resource") != resource:
        raise HTTPException(status_code=403, detail="PDF download token does not match this resource")


def _pdf_token(current_user: CurrentUser, resource: str) -> dict:
    token = create_access_token(
        subject=current_user.id,
        role=current_user.role,
        expires_delta=timedelta(seconds=60),
        extra_claims={"typ": "pdf-download", "resource": resource},
    )
    return {"token": token, "expires_in": 60, "resource": resource}


def create_receipt_download_token(payment_id: int, expires_seconds: int = 3600 * 24 * 30) -> str:
    return create_access_token(
        subject=f"payment:{payment_id}",
        role="receipt",
        expires_delta=timedelta(seconds=expires_seconds),
        extra_claims={"typ": "pdf-download", "resource": f"receipt:{payment_id}"},
    )


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
    payment = db.query(FeePayment).filter_by(id=payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    student_fee = db.query(StudentFee).filter_by(id=payment.student_fee_id).first()
    if not student_fee:
        raise HTTPException(status_code=404, detail="Payment record is invalid")
    ensure_student_access(db, current_user, student_fee.student_id)
    return _pdf_token(current_user, f"receipt:{payment_id}")

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
        pdf_path=f"/api/v1/pdf/marksheet/student/{student_id}?exam_id={exam_id}&class_id={class_id}",
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
    db: Session = Depends(get_db)
):
    _require_pdf_token(token, f"marksheet:class:{class_id}:exam:{exam_id}")
    pdf = render_marksheet_pdf(db, exam_id, class_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="No marks found for this class")
    report_card_service.upsert_class_report_cards(db, class_id=class_id, exam_id=exam_id)
    db.commit()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=marksheet_class_{class_id}.pdf"}
    )


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
