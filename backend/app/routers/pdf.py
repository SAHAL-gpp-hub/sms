from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.pdf.marksheet_pdf import render_marksheet_pdf
from app.pdf.report_pdf import (
    render_defaulter_report,
    render_attendance_report,
    render_result_report
)

router = APIRouter(prefix="/api/v1/pdf", tags=["PDF"])

# Marksheet PDFs
@router.get("/marksheet/student/{student_id}")
def generate_student_marksheet(
    student_id: int,
    exam_id: int = Query(...),
    class_id: int = Query(...),
    db: Session = Depends(get_db)
):
    pdf = render_marksheet_pdf(db, exam_id, class_id, student_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="No marks found for this student")
    return Response(content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=marksheet_{student_id}.pdf"})

@router.get("/marksheet/class/{class_id}")
def generate_class_marksheet(
    class_id: int,
    exam_id: int = Query(...),
    db: Session = Depends(get_db)
):
    pdf = render_marksheet_pdf(db, exam_id, class_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="No marks found for this class")
    return Response(content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=marksheet_class_{class_id}.pdf"})

# Report PDFs
@router.get("/report/defaulters")
def defaulter_report(
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    pdf = render_defaulter_report(db, academic_year_id)
    return Response(content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=defaulter_report.pdf"})

@router.get("/report/attendance")
def attendance_report(
    class_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db)
):
    pdf = render_attendance_report(db, class_id, year, month)
    return Response(content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=attendance_report.pdf"})

@router.get("/report/results")
def result_report(
    exam_id: int = Query(...),
    class_id: int = Query(...),
    db: Session = Depends(get_db)
):
    pdf = render_result_report(db, exam_id, class_id)
    return Response(content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=result_report.pdf"})