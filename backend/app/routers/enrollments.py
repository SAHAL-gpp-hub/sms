"""
app/routers/enrollments.py

New router exposing the Enrollment table.

Endpoints:
  GET  /enrollments/                          — list with filters
  GET  /enrollments/{enrollment_id}           — single enrollment
  GET  /enrollments/student/{student_id}      — all enrollments for a student (history)
  GET  /enrollments/class/{class_id}/roll-list — ordered roll list for a class/year
  POST /enrollments/reassign-rolls            — re-sequence roll numbers
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import Enrollment
from app.routers.auth import CurrentUser, require_role
from app.services.enrollment_service import (
    get_enrollment,
    get_enrollment_for_student,
    list_enrollments,
    get_class_roll_list,
    reassign_roll_numbers,
)

router = APIRouter(prefix="/api/v1/enrollments", tags=["Enrollments"])


class RollReassignRequest(BaseModel):
    class_id:         int
    academic_year_id: int
    strategy:         str = "alphabetical"   # alphabetical / sequential / by_gr_number


@router.get("/")
def list_enrollments_endpoint(
    academic_year_id: Optional[int] = Query(None),
    class_id:         Optional[int] = Query(None),
    status:           Optional[str] = Query(None),
    student_id:       Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "teacher")),
):
    enrollments = list_enrollments(db, academic_year_id, class_id, status, student_id)
    return [_serialize(e) for e in enrollments]


@router.get("/student/{student_id}")
def get_student_enrollment_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher", "student", "parent")),
):
    """
    Returns all enrollments for a student — their full academic history.
    Students and parents can only see their own.
    """
    if current_user.role == "student":
        if current_user.linked_student_id != student_id:
            raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == "parent":
        if student_id not in current_user.linked_student_ids:
            raise HTTPException(status_code=403, detail="Access denied")

    enrollments = list_enrollments(db, student_id=student_id)
    return [_serialize(e) for e in enrollments]


@router.get("/{enrollment_id}")
def get_single_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "teacher")),
):
    e = get_enrollment(db, enrollment_id)
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return _serialize(e)


@router.get("/class/{class_id}/roll-list")
def get_roll_list(
    class_id:         int,
    academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "teacher")),
):
    """
    Returns the ordered roll list for a class — used for attendance sheets,
    marks entry, and printing class lists.
    """
    return get_class_roll_list(db, class_id, academic_year_id)


@router.post("/reassign-rolls")
def reassign_rolls(
    data: RollReassignRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    """
    Re-sequences roll numbers for all active enrollments in a class.
    Use after section merges or when alphabetical order is required.
    """
    result = reassign_roll_numbers(
        db, data.class_id, data.academic_year_id, data.strategy
    )
    return result


def _serialize(e: Enrollment) -> dict:
    return {
        "id":               e.id,
        "student_id":       e.student_id,
        "academic_year_id": e.academic_year_id,
        "class_id":         e.class_id,
        "roll_number":      e.roll_number,
        "status":           e.status.value if hasattr(e.status, "value") else e.status,
        "promotion_action": e.promotion_action,
        "enrolled_on":      str(e.enrolled_on) if e.enrolled_on else None,
    }