from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import Student
from app.pdf.report_pdf import render_tc_pdf
from app.routers.auth import CurrentUser, ensure_student_access, require_role
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate
from app.services import student_service
from fastapi.responses import Response

router = APIRouter(prefix="/api/v1/students", tags=["Students"])


@router.post("/", response_model=StudentOut, status_code=201)
def create_student(
    data: StudentCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    return student_service.create_student(db, data)


@router.get("/", response_model=List[StudentOut])
def list_students(
    class_id: Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher", "student", "parent")),
):
    if current_user.role == "teacher":
        if class_id is not None and class_id not in current_user.assigned_class_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this class")
        return student_service.get_students(
            db=db,
            class_id=class_id,
            class_ids=current_user.assigned_class_ids if class_id is None else None,
            search=search,
            academic_year_id=academic_year_id,
            branch_id=branch_id,
            limit=limit,
            offset=offset,
        )
    if current_user.role == "student":
        if current_user.linked_student_id is None:
            return []
        return student_service.get_students(
            db=db,
            student_ids=[current_user.linked_student_id],
            search=search,
            academic_year_id=academic_year_id,
            branch_id=branch_id,
            limit=limit,
            offset=offset,
        )
    if current_user.role == "parent":
        if not current_user.linked_student_ids:
            return []
        return student_service.get_students(
            db=db,
            class_id=class_id,
            student_ids=current_user.linked_student_ids,
            search=search,
            academic_year_id=academic_year_id,
            branch_id=branch_id,
            limit=limit,
            offset=offset,
        )
    return student_service.get_students(
        db=db,
        class_id=class_id,
        search=search,
        academic_year_id=academic_year_id,
        branch_id=branch_id,
        limit=limit,
        offset=offset,
    )


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher", "student", "parent")),
):
    ensure_student_access(db, current_user, student_id)
    return student_service.get_student(db, student_id)


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    data: StudentUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    student = student_service.update_student(db, student_id, data)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    success = student_service.delete_student(db, student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student marked as Left successfully"}


@router.get("/{student_id}/tc")
def get_student_tc(
    student_id: int,
    reason: str = Query("Parent's Request"),
    conduct: str = Query("Good"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    ensure_student_access(db, current_user, student_id)
    pdf = render_tc_pdf(db, student_id, reason, conduct)
    if not pdf:
        raise HTTPException(status_code=404, detail="Student not found")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=TC_{student_id}.pdf"},
    )
