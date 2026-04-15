"""
app/routers/yearend.py

BUG 3 FIX (router side): bulk_promote_students now returns a dict with
"error" key for both the end-of-ladder case AND the unrecognised-class-name
case. The router converts both to HTTP 400 with the specific message so
the frontend can display it clearly to the user.

PDF DOWNLOAD FIX: tc-pdf and any future download endpoints do NOT use the
router-level auth dependency — they are called by the browser directly via
window.open() / <a href> which cannot send an Authorization header.
Write operations (promote, new-year, issue-tc) remain protected and require
a valid JWT token via the get_current_user dependency.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.services import yearend_service
from app.pdf.report_pdf import render_tc_pdf

router = APIRouter(prefix="/api/v1/yearend", tags=["Year-End"])


class NewYearRequest(BaseModel):
    label:      str
    start_date: str
    end_date:   str


class TCRequest(BaseModel):
    reason:  str = "Parent's Request"
    conduct: str = "Good"


# ──────────────────────────────────────────────
# READ-ONLY / DOWNLOAD ENDPOINTS — no auth required
# (browser opens these directly via window.open / <a href>)
# ──────────────────────────────────────────────

@router.get("/tc-pdf/{student_id}")
def download_tc(
    student_id: int,
    reason:     str = Query(default="Parent's Request"),
    conduct:    str = Query(default="Good"),
    db: Session = Depends(get_db),
):
    """Generate TC PDF — no auth required (browser direct download)."""
    pdf = render_tc_pdf(db, student_id, reason, conduct)
    if not pdf:
        raise HTTPException(status_code=404, detail="Student not found")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=TC_{student_id}.pdf"},
    )


@router.get("/current-year")
def get_current_year(db: Session = Depends(get_db)):
    """Get current academic year — public, used by sidebar."""
    from app.models.base_models import AcademicYear
    year = db.query(AcademicYear).filter_by(is_current=True).first()
    if not year:
        raise HTTPException(status_code=404, detail="No current academic year set")
    return {"id": year.id, "label": year.label, "is_current": year.is_current}


@router.get("/years")
def get_all_years(db: Session = Depends(get_db)):
    """Get all academic years — public."""
    from app.models.base_models import AcademicYear
    years = db.query(AcademicYear).order_by(AcademicYear.id.desc()).all()
    return [{"id": y.id, "label": y.label, "is_current": y.is_current} for y in years]


# ──────────────────────────────────────────────
# WRITE ENDPOINTS — require JWT auth
# ──────────────────────────────────────────────

@router.post("/promote/{class_id}")
def promote_class(
    class_id:             int,
    new_academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    result = yearend_service.bulk_promote_students(db, class_id, new_academic_year_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/new-year")
def create_new_year(
    data: NewYearRequest,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    year = yearend_service.create_academic_year(
        db, data.label, data.start_date, data.end_date
    )
    return {"id": year.id, "label": year.label, "is_current": year.is_current}


@router.post("/issue-tc/{student_id}")
def issue_tc(
    student_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    student = yearend_service.issue_tc(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": f"TC issued for {student.name_en}", "status": student.status}