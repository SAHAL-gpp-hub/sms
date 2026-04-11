from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.services import yearend_service
from app.pdf.report_pdf import render_tc_pdf

router = APIRouter(prefix="/api/v1/yearend", tags=["Year-End"])

class NewYearRequest(BaseModel):
    label: str
    start_date: str
    end_date: str

class TCRequest(BaseModel):
    reason: str = "Parent's Request"
    conduct: str = "Good"

@router.post("/promote/{class_id}")
def promote_class(
    class_id: int,
    new_academic_year_id: int = Query(...),
    db: Session = Depends(get_db)
):
    result = yearend_service.bulk_promote_students(db, class_id, new_academic_year_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.post("/new-year")
def create_new_year(data: NewYearRequest, db: Session = Depends(get_db)):
    year = yearend_service.create_academic_year(
        db, data.label, data.start_date, data.end_date
    )
    return {"id": year.id, "label": year.label, "is_current": year.is_current}

@router.post("/issue-tc/{student_id}")
def issue_tc(student_id: int, db: Session = Depends(get_db)):
    student = yearend_service.issue_tc(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": f"TC issued for {student.name_en}", "status": student.status}

@router.get("/tc-pdf/{student_id}")
def download_tc(
    student_id: int,
    reason: str = Query(default="Parent's Request"),
    conduct: str = Query(default="Good"),
    db: Session = Depends(get_db)
):
    pdf = render_tc_pdf(db, student_id, reason, conduct)
    if not pdf:
        raise HTTPException(status_code=404, detail="Student not found")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=TC_{student_id}.pdf"}
    )

@router.get("/current-year")
def get_current_year(db: Session = Depends(get_db)):
    from app.models.base_models import AcademicYear
    year = db.query(AcademicYear).filter_by(is_current=True).first()
    if not year:
        raise HTTPException(status_code=404, detail="No current academic year set")
    return {"id": year.id, "label": year.label, "is_current": year.is_current}

@router.get("/years")
def get_all_years(db: Session = Depends(get_db)):
    from app.models.base_models import AcademicYear
    years = db.query(AcademicYear).order_by(AcademicYear.id.desc()).all()
    return [{"id": y.id, "label": y.label, "is_current": y.is_current} for y in years]
