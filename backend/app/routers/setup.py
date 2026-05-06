from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.models.base_models import AcademicYear, Class
from app.routers.auth import CurrentUser, require_role
from app.services.yearend_service import normalize_class_name

router = APIRouter(prefix="/api/v1/setup", tags=["Setup"])

class ClassCreate(BaseModel):
    name: Optional[str] = None
    standard: Optional[int] = None
    division: str = "A"
    academic_year_id: int

@router.post("/seed")
def seed_data(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
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
    if academic_year_id:
        classes = db.query(Class).filter_by(academic_year_id=academic_year_id).all()
    else:
        classes = db.query(Class).all()   # ← was filtering by current year
    return [{"id": c.id, "name": c.name, "division": c.division, "academic_year_id": c.academic_year_id} for c in classes]

@router.post("/classes", status_code=201)
def create_class(
    data: ClassCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    class_name = normalize_class_name(data.name or str(data.standard))
    # Check for duplicate
    existing = db.query(Class).filter_by(
        name=class_name,
        division=data.division,
        academic_year_id=data.academic_year_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Class with this name, division and academic year already exists")
    cls = Class(name=class_name, division=data.division, academic_year_id=data.academic_year_id)
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return {"id": cls.id, "name": cls.name, "division": cls.division, "academic_year_id": cls.academic_year_id}

@router.delete("/classes/{class_id}")
def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    cls = db.query(Class).filter_by(id=class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    db.delete(cls)
    db.commit()
    return {"message": "Deleted"}

@router.get("/academic-years")
def get_academic_years(db: Session = Depends(get_db)):
    years = db.query(AcademicYear).order_by(AcademicYear.id.desc()).all()
    return [{"id": y.id, "label": y.label, "is_current": y.is_current} for y in years]
