from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.models.base_models import AcademicYear, Class

router = APIRouter(prefix="/api/v1/setup", tags=["Setup"])

@router.post("/seed")
def seed_data(db: Session = Depends(get_db)):
    year = db.query(AcademicYear).filter_by(label="2025-26").first()
    if not year:
        year = AcademicYear(
            label="2025-26",
            start_date="2025-06-01",
            end_date="2026-03-31",
            is_current=True
        )
        db.add(year)
        db.commit()
        db.refresh(year)

    class_names = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
    for name in class_names:
        existing = db.query(Class).filter_by(name=name, academic_year_id=year.id).first()
        if not existing:
            db.add(Class(name=name, division="A", academic_year_id=year.id))
    db.commit()

    classes = db.query(Class).filter_by(academic_year_id=year.id).all()
    return {
        "message": "Seed data created",
        "academic_year": year.label,
        "classes": [{"id": c.id, "name": c.name} for c in classes]
    }

@router.get("/classes")
def get_classes(
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    # If no year specified, use current year
    if academic_year_id:
        classes = db.query(Class).filter_by(academic_year_id=academic_year_id).all()
    else:
        current_year = db.query(AcademicYear).filter_by(is_current=True).first()
        if current_year:
            classes = db.query(Class).filter_by(academic_year_id=current_year.id).all()
        else:
            classes = db.query(Class).all()
    return [{"id": c.id, "name": c.name, "division": c.division, "academic_year_id": c.academic_year_id} for c in classes]

@router.get("/academic-years")
def get_academic_years(db: Session = Depends(get_db)):
    years = db.query(AcademicYear).order_by(AcademicYear.id.desc()).all()
    return [{"id": y.id, "label": y.label, "is_current": y.is_current} for y in years]