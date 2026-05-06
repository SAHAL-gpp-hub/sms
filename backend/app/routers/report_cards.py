from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import AcademicYear, Class, Enrollment, Exam, ReportCard, Student
from app.routers.auth import CurrentUser, ensure_class_access, require_role

router = APIRouter(prefix="/api/v1/report-cards", tags=["Report Cards"])


class ReportCardUpdate(BaseModel):
    is_locked: bool


@router.get("/")
def list_report_cards(
    exam_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "teacher")),
):
    if class_id is not None:
        ensure_class_access(current_user, class_id)

    query = (
        db.query(ReportCard, Enrollment, Student, Exam, Class, AcademicYear)
        .join(Enrollment, ReportCard.enrollment_id == Enrollment.id)
        .join(Student, Enrollment.student_id == Student.id)
        .join(Class, Enrollment.class_id == Class.id)
        .join(AcademicYear, Enrollment.academic_year_id == AcademicYear.id)
        .outerjoin(Exam, ReportCard.exam_id == Exam.id)
    )

    if current_user.role == "teacher":
      query = query.filter(Enrollment.class_id.in_(current_user.assigned_class_ids or [-1]))
    if exam_id is not None:
        query = query.filter(ReportCard.exam_id == exam_id)
    if class_id is not None:
        query = query.filter(Enrollment.class_id == class_id)
    if academic_year_id is not None:
        query = query.filter(Enrollment.academic_year_id == academic_year_id)
    if student_id is not None:
        query = query.filter(Enrollment.student_id == student_id)

    rows = (
        query.order_by(ReportCard.generated_at.desc(), ReportCard.id.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": report_card.id,
            "enrollment_id": enrollment.id,
            "exam_id": report_card.exam_id,
            "exam_name": exam.name if exam else None,
            "student_id": student.id,
            "student_name": student.name_en,
            "class_id": enrollment.class_id,
            "class_name": klass.name,
            "division": klass.division,
            "academic_year_id": enrollment.academic_year_id,
            "academic_year_label": year.label,
            "pdf_path": report_card.pdf_path,
            "is_locked": report_card.is_locked,
            "generated_at": report_card.generated_at.isoformat() if report_card.generated_at else None,
            "locked_at": report_card.locked_at.isoformat() if report_card.locked_at else None,
        }
        for report_card, enrollment, student, exam, klass, year in rows
    ]


@router.patch("/{report_card_id}")
def update_report_card(
    report_card_id: int,
    data: ReportCardUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    report_card = db.query(ReportCard).filter_by(id=report_card_id).first()
    if not report_card:
        raise HTTPException(status_code=404, detail="Report card not found")

    report_card.is_locked = data.is_locked
    report_card.locked_at = datetime.now(timezone.utc) if data.is_locked else None
    db.commit()
    db.refresh(report_card)
    return {
        "id": report_card.id,
        "is_locked": report_card.is_locked,
        "locked_at": report_card.locked_at.isoformat() if report_card.locked_at else None,
    }
