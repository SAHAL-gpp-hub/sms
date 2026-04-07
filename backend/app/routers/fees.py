from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.schemas.fee import (
    FeeHeadCreate, FeeHeadOut,
    FeeStructureCreate, FeeStructureOut,
    PaymentCreate, PaymentOut,
    StudentLedger
)
from app.services import fee_service

router = APIRouter(prefix="/api/v1/fees", tags=["Fees"])

# Fee Heads
@router.get("/heads", response_model=list[FeeHeadOut])
def get_fee_heads(db: Session = Depends(get_db)):
    return fee_service.get_fee_heads(db)

@router.post("/heads", response_model=FeeHeadOut, status_code=201)
def create_fee_head(data: FeeHeadCreate, db: Session = Depends(get_db)):
    return fee_service.create_fee_head(db, data)

@router.post("/heads/seed")
def seed_fee_heads(db: Session = Depends(get_db)):
    fee_service.seed_fee_heads(db)
    return {"message": "Fee heads seeded successfully"}

# Fee Structure
@router.get("/structure", response_model=list[FeeStructureOut])
def get_fee_structures(
    class_id: Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return fee_service.get_fee_structures(db, class_id, academic_year_id)

@router.post("/structure", response_model=FeeStructureOut, status_code=201)
def create_fee_structure(data: FeeStructureCreate, db: Session = Depends(get_db)):
    return fee_service.create_fee_structure(db, data)

@router.delete("/structure/{fs_id}")
def delete_fee_structure(fs_id: int, db: Session = Depends(get_db)):
    fs = fee_service.delete_fee_structure(db, fs_id)
    if not fs:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    return {"message": "Deleted successfully"}

# Assign fees to all students in a class
@router.post("/assign/{class_id}")
def assign_fees(
    class_id: int,
    academic_year_id: int = Query(...),
    db: Session = Depends(get_db)
):
    count = fee_service.assign_fees_to_class(db, class_id, academic_year_id)
    return {"message": f"Assigned fees to {count} student-fee records"}

# Student Ledger
@router.get("/ledger/{student_id}", response_model=StudentLedger)
def get_ledger(student_id: int, db: Session = Depends(get_db)):
    ledger = fee_service.get_student_ledger(db, student_id)
    if not ledger:
        raise HTTPException(status_code=404, detail="Student not found")
    return ledger

# Payments
@router.post("/payment", response_model=PaymentOut, status_code=201)
def record_payment(data: PaymentCreate, db: Session = Depends(get_db)):
    return fee_service.record_payment(db, data)

@router.get("/payments/{student_id}", response_model=list[PaymentOut])
def get_payments(student_id: int, db: Session = Depends(get_db)):
    return fee_service.get_payments_by_student(db, student_id)

# Defaulters
@router.get("/defaulters")
def get_defaulters(
    class_id: Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return fee_service.get_defaulters(db, class_id, academic_year_id)