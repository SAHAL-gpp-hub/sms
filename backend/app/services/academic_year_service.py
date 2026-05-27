from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.base_models import AcademicYear, YearStatusEnum


def get_current_academic_year(db: Session) -> AcademicYear | None:
    return (
        db.query(AcademicYear)
        .filter(AcademicYear.is_current == True)  # noqa: E712
        .first()
        or db.query(AcademicYear)
        .filter(AcademicYear.status == YearStatusEnum.active)
        .order_by(AcademicYear.start_date.desc())
        .first()
    )


def require_current_academic_year(db: Session) -> AcademicYear:
    year = get_current_academic_year(db)
    if not year:
        raise HTTPException(status_code=422, detail="No active academic year is configured.")
    return year
