"""
app/routers/fees.py

ISSUE 2 FIX: assign_fees endpoint was silently returning assigned=0 when
academic_year_id didn't match any students. Added an informative response
message when assignment produces 0 results so operators know to check the
year filter.

ISSUE 4 (partial): FeeStructure GET single was not imported from the service
layer — it did an inline query inside the router. Moved to fee_service for
consistency and to respect the service-layer boundary.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from decimal import Decimal

from app.core.database import get_db
from app.core.cache import response_cache
from app.core.config import settings
from app.models.base_models import AcademicYear, StudentFee, FeePayment
from app.models.base_models import Enrollment, EnrollmentStatusEnum, FeeStructure
from app.routers.auth import CurrentUser, ensure_student_access, require_role
from app.schemas.fee import (
    FeeHeadCreate, FeeHeadOut,
    FeePlanApplyResult, FeePlanPreview, FeePlanRequest,
    FeeStructureCreate, FeeStructureOut,
    PaymentCreate, PaymentHistoryOut, PaymentOut,
    StudentLedger,
)
from app.services import fee_service

router = APIRouter(prefix="/api/v1/fees", tags=["Fees"])

def _invalidate_fee_caches() -> None:
    response_cache.invalidate_prefix("defaulters:")
    response_cache.invalidate_prefix("dashboard_stats:")


# ---------------------------------------------------------------------------
# Fee Heads
# ---------------------------------------------------------------------------

@router.get("/heads", response_model=list[FeeHeadOut])
def get_fee_heads(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "teacher", "student", "parent")),
):
    return fee_service.get_fee_heads(db)


@router.post("/heads", response_model=FeeHeadOut, status_code=201)
def create_fee_head(
    data: FeeHeadCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    out = fee_service.create_fee_head(db, data)
    _invalidate_fee_caches()
    return out


@router.post("/heads/seed")
def seed_fee_heads(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    fee_service.seed_fee_heads(db)
    _invalidate_fee_caches()
    return {"message": "Fee heads seeded successfully"}


# ---------------------------------------------------------------------------
# Fee Structure
# ---------------------------------------------------------------------------

@router.get("/structure", response_model=list[FeeStructureOut])
def get_fee_structures(
    class_id:         Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "teacher", "student", "parent")),
):
    return fee_service.get_fee_structures(db, class_id, academic_year_id)


@router.get("/structure/{fs_id}", response_model=FeeStructureOut)
def get_fee_structure(
    fs_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin", "teacher")),
):
    fs = fee_service.get_fee_structure(db, fs_id)
    if not fs:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    return fs


@router.post("/structure", response_model=FeeStructureOut, status_code=201)
def create_fee_structure(
    data: FeeStructureCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    try:
        out = fee_service.create_fee_structure(db, data)
        _invalidate_fee_caches()
        return out
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _preview_fee_plan(db: Session, data: FeePlanRequest) -> dict:
    class_ids = fee_service.get_same_standard_class_ids(db, data.class_id, data.academic_year_id)
    affected = db.query(Enrollment.id).filter(
        Enrollment.class_id.in_(class_ids),
        Enrollment.academic_year_id == data.academic_year_id,
        Enrollment.status.in_([
            EnrollmentStatusEnum.active,
            EnrollmentStatusEnum.retained,
            EnrollmentStatusEnum.provisional,
        ]),
    ).count()
    fee_head_ids = [item.fee_head_id for item in data.items]
    existing = 0
    if fee_head_ids:
        existing = db.query(FeeStructure.id).filter(
            FeeStructure.class_id.in_(class_ids),
            FeeStructure.academic_year_id == data.academic_year_id,
            FeeStructure.fee_head_id.in_(fee_head_ids),
        ).count()
    warnings = []
    if affected == 0:
        warnings.append("No active students match this class and academic year.")
    if existing:
        warnings.append(f"{existing} fee item(s) already exist and will be updated.")
    return {
        "class_id": data.class_id,
        "academic_year_id": data.academic_year_id,
        "affected_students": affected,
        "item_count": len(data.items),
        "total_per_student": sum((item.amount for item in data.items), start=Decimal("0.00")),
        "existing_items": existing,
        "warnings": warnings,
    }


@router.post("/structure/preview", response_model=FeePlanPreview)
def preview_fee_plan(
    data: FeePlanRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    return _preview_fee_plan(db, data)


@router.post("/structure/apply", response_model=FeePlanApplyResult)
def apply_fee_plan(
    data: FeePlanRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    preview = _preview_fee_plan(db, data)
    try:
        # M4 fix: resolve same-standard class IDs once (2 queries) instead of
        # re-resolving them inside create_fee_structure_for_standard per item
        # and again for the assign step below.
        class_ids = fee_service.get_same_standard_class_ids(db, data.class_id, data.academic_year_id)
        for item in data.items:
            for class_id in class_ids:
                fee_service.create_fee_structure(db, FeeStructureCreate(
                    class_id=class_id,
                    fee_head_id=item.fee_head_id,
                    amount=item.amount,
                    due_date=item.due_date,
                    academic_year_id=data.academic_year_id,
                ))
        assigned = sum(
            fee_service.assign_fees_to_class(db, class_id, data.academic_year_id)
            for class_id in class_ids
        )
        _invalidate_fee_caches()
        return {**preview, "assigned": assigned}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/structure/{fs_id}")
def delete_fee_structure(
    fs_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    fs = fee_service.delete_fee_structure(db, fs_id)
    if not fs:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    _invalidate_fee_caches()
    return {"message": "Deleted successfully"}


# ---------------------------------------------------------------------------
# Assign fees to all students in a class
# ---------------------------------------------------------------------------

@router.post("/assign/{class_id}")
def assign_fees(
    class_id:         int,
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    if not academic_year_id:
        year = db.query(AcademicYear).filter_by(is_current=True).first()
        if not year:
            # STEP 3.7 FIX: raise an explicit error instead of silently
            # falling back to academic_year_id=1, which produces confusing
            # results when year 1 doesn't exist or is not the current year.
            raise HTTPException(
                status_code=422,
                detail="No current academic year is set. Create one first via /yearend/new-year.",
            )
        academic_year_id = year.id

    count = fee_service.assign_fees_to_class(db, class_id, academic_year_id)

    # ISSUE 2 FIX: surface a clear message when 0 fees were assigned so the
    # operator knows there is a year/class mismatch rather than assuming success.
    if count == 0:
        _invalidate_fee_caches()
        return {
            "message": (
                "No student-fee records were created. "
                "Check that students exist in this class for the selected academic year "
                "and that a fee structure has been defined."
            ),
            "assigned": 0,
        }
    _invalidate_fee_caches()
    return {"message": f"Assigned fees to {count} student-fee records", "assigned": count}


@router.post("/assign")
def assign_fees_body(
    class_id:         Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    if not class_id:
        raise HTTPException(status_code=422, detail="class_id required")
    if not academic_year_id:
        year = db.query(AcademicYear).filter_by(is_current=True).first()
        if not year:
            raise HTTPException(
                status_code=422,
                detail="No current academic year is set. Create one first via /yearend/new-year.",
            )
        academic_year_id = year.id

    count = fee_service.assign_fees_to_class(db, class_id, academic_year_id)
    if count == 0:
        _invalidate_fee_caches()
        return {
            "message": (
                "No student-fee records were created. "
                "Check that students exist in this class for the selected academic year "
                "and that a fee structure has been defined."
            ),
            "assigned": 0,
        }
    _invalidate_fee_caches()
    return {"message": f"Assigned fees to {count} student-fee records", "assigned": count}


# ---------------------------------------------------------------------------
# Student Ledger
# ---------------------------------------------------------------------------

@router.get("/ledger/{student_id}", response_model=StudentLedger)
def get_ledger(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "student", "parent")),
):
    ensure_student_access(db, current_user, student_id)
    ledger = fee_service.get_student_ledger(db, student_id)
    if not ledger:
        raise HTTPException(status_code=404, detail="Student not found")
    return ledger


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

@router.post("/payment", response_model=PaymentOut, status_code=201)
def record_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin")),
):
    try:
        out = fee_service.record_payment(db, data, actor_user_id=current_user.id)
        _invalidate_fee_caches()
        return out
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/payment")
def get_payments_query(
    student_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "student", "parent")),
):
    ensure_student_access(db, current_user, student_id)
    return fee_service.get_payments_by_student(db, student_id)


@router.get("/payments/{student_id}", response_model=list[PaymentHistoryOut])
def get_payments(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "student", "parent")),
):
    ensure_student_access(db, current_user, student_id)
    return fee_service.get_payments_by_student(db, student_id)


# ---------------------------------------------------------------------------
# Defaulters
# ---------------------------------------------------------------------------

@router.get("/defaulters")
def get_defaulters(
    class_id:         Optional[int] = Query(None),
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    cache_key = f"defaulters:class={class_id or 'all'}:year={academic_year_id or 'all'}"
    cached = response_cache.get(cache_key)
    if cached is not None:
        return cached
    data = fee_service.get_defaulters(db, class_id, academic_year_id)
    response_cache.set(cache_key, data, settings.RESPONSE_CACHE_TTL_SECONDS)
    return data


@router.get("/monthly-collections")
def get_monthly_collections(
    month:            int           = Query(..., ge=1, le=12),
    academic_year_id: Optional[int] = Query(None),
    db:               Session       = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    return fee_service.get_monthly_collections(db, month, academic_year_id)


@router.get("/payment-options/{student_id}")
def get_payment_options(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("admin", "student", "parent")),
):
    ensure_student_access(db, current_user, student_id)
    return fee_service.get_payment_options(db, student_id)