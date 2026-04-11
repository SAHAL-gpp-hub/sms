from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.pdf.report_pdf import render_tc_pdf
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate
from app.services import student_service
from fastapi.responses import Response

router = APIRouter(prefix="/api/v1/students", tags=["Students"])


@router.post("/", response_model=StudentOut, status_code=201)
def create_student(data: StudentCreate, db: Session = Depends(get_db)):
    return student_service.create_student(db, data)


@router.get("/", response_model=List[StudentOut])
def list_students(
    class_id: Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return student_service.get_students(db, class_id, search, academic_year_id)


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = student_service.get_student(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.put("/{student_id}", response_model=StudentOut)
def update_student(student_id: int, data: StudentUpdate, db: Session = Depends(get_db)):
    student = student_service.update_student(db, student_id, data)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    success = student_service.delete_student(db, student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student marked as Left successfully"}


@router.get("/{student_id}/tc")
def get_student_tc(student_id: int, db: Session = Depends(get_db)):
    pdf = render_tc_pdf(db, student_id, "Parent's Request", "Good")
    if not pdf:
        raise HTTPException(status_code=404, detail="Student not found")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=TC_{student_id}.pdf"},
    )
