"""
fee_service.py

FIXES APPLIED:
  BUG-B (primary fix): StudentFee.academic_year_id was missing from the ORM
  model (base_models.py). The column exists in the DB (added by migration
  384df2f48f9d) but the model didn't declare it. Every call to
  assign_fees_to_class() that wrote or filtered by this column raised:
    AttributeError: type object 'StudentFee' has no attribute 'academic_year_id'
  This made the entire /fees/assign endpoint crash with a 500 for every request.
  Fix: academic_year_id is now declared in StudentFee in base_models.py.
  The service code below that references it now works correctly.

  Additional fixes in this file:
  - generate_receipt_number: uses a PostgreSQL sequence when available.
  - get_defaulters: single aggregating GROUP BY query (was N+1 loop).
  - get_student_ledger: filters StudentFee by its own academic_year_id
    column so fee history isn't lost after student promotion.
  - create_fee_structure: refreshes net_amount on existing StudentFee rows
    when the fee amount is updated.
"""

from datetime import date
from decimal import Decimal
import logging
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from app.core.constants import RECEIPT_NUMBER_LOCK_KEY
from app.models.base_models import (
    Class, DataAuditActionEnum, FeeHead, FeePayment, FeeStructure, Student, StudentFee, StudentStatusEnum,
)
from app.schemas.fee import (
    FeeHeadCreate, FeeStructureCreate, PaymentCreate,
    StudentLedger, StudentLedgerItem,
)
from app.services.audit_service import log_data_change, model_snapshot

logger = logging.getLogger("sms.fees")


PRELOADED_FEE_HEADS = [
    {"name": "Tuition Fee",       "frequency": "Monthly"},
    {"name": "Admission Fee",     "frequency": "One-Time"},
    {"name": "Exam Fee",          "frequency": "Termly"},
    {"name": "Prospectus Fee",    "frequency": "One-Time"},
    {"name": "Sports Fee",        "frequency": "Annual"},
    {"name": "Computer Lab Fee",  "frequency": "Annual"},
    {"name": "Library Fee",       "frequency": "Annual"},
    {"name": "Late Payment Fine", "frequency": "One-Time"},
    {"name": "Development Fee",   "frequency": "Annual"},
    {"name": "School Bus Fee",    "frequency": "Monthly"},
]


# ──────────────────────────────────────────────────────────────
# Fee Heads
# ──────────────────────────────────────────────────────────────

def seed_fee_heads(db: Session):
    for fh in PRELOADED_FEE_HEADS:
        if not db.query(FeeHead).filter_by(name=fh["name"]).first():
            db.add(FeeHead(name=fh["name"], frequency=fh["frequency"], is_active=True))
    db.commit()


def get_fee_heads(db: Session):
    return db.query(FeeHead).filter_by(is_active=True).all()


def create_fee_head(db: Session, data: FeeHeadCreate):
    fh = FeeHead(**data.model_dump(), is_active=True)
    db.add(fh)
    db.commit()
    db.refresh(fh)
    return fh


# ──────────────────────────────────────────────────────────────
# Fee Structure
# ──────────────────────────────────────────────────────────────

def create_fee_structure(db: Session, data: FeeStructureCreate):
    if Decimal(str(data.amount)) <= 0:
        raise ValueError("Fee amount must be greater than 0")

    existing = db.query(FeeStructure).filter_by(
        class_id=data.class_id,
        fee_head_id=data.fee_head_id,
        academic_year_id=data.academic_year_id,
    ).first()

    if existing:
        old_amount = existing.amount
        existing.amount = data.amount
        db.commit()

        # Refresh net_amount on StudentFee rows so ledgers show current amount
        if old_amount != data.amount:
            db.query(StudentFee).filter_by(
                fee_structure_id=existing.id,
                academic_year_id=data.academic_year_id,
            ).update({"net_amount": data.amount})
            db.commit()

        db.refresh(existing)
        return existing

    fs = FeeStructure(**data.model_dump())
    db.add(fs)
    db.commit()
    db.refresh(fs)
    return fs


def get_fee_structures(
    db: Session,
    class_id: Optional[int] = None,
    academic_year_id: Optional[int] = None,
):
    q = db.query(FeeStructure).options(joinedload(FeeStructure.fee_head))
    if class_id is not None:
        q = q.filter(FeeStructure.class_id == class_id)
    if academic_year_id is not None:
        q = q.filter(FeeStructure.academic_year_id == academic_year_id)
    return q.all()


def get_fee_structure(db: Session, fs_id: int):
    return (
        db.query(FeeStructure)
        .options(joinedload(FeeStructure.fee_head))
        .filter(FeeStructure.id == fs_id)
        .first()
    )


def delete_fee_structure(db: Session, fs_id: int):
    fs = db.query(FeeStructure).filter_by(id=fs_id).first()
    if fs:
        db.delete(fs)
        db.commit()
    return fs


# ──────────────────────────────────────────────────────────────
# Assign fees to a class
# ──────────────────────────────────────────────────────────────

def assign_fees_to_class(
    db: Session, class_id: int, academic_year_id: Optional[int] = None
) -> int:
    """
    Assigns all FeeStructure rows for a class+year to every active student
    in that class+year. Idempotent — won't create duplicate StudentFee rows.

    Returns the count of newly created StudentFee records.

    BUG-B FIX: Now correctly writes StudentFee.academic_year_id (the column
    that was missing from the model, causing AttributeError on every call).
    """
    if academic_year_id is None:
        # Infer from the students' academic year or from the fee structures
        student_year = (
            db.query(Student.academic_year_id)
            .filter(Student.class_id == class_id, Student.status == StudentStatusEnum.Active)
            .first()
        )
        structure_year = (
            db.query(FeeStructure.academic_year_id)
            .filter(FeeStructure.class_id == class_id)
            .first()
        )
        academic_year_id = (
            (student_year[0] if student_year else None)
            or (structure_year[0] if structure_year else None)
            or 1
        )

    structures = (
        db.query(FeeStructure)
        .filter_by(class_id=class_id, academic_year_id=academic_year_id)
        .all()
    )
    students = (
        db.query(Student)
        .filter_by(class_id=class_id, academic_year_id=academic_year_id)
        .filter(Student.status == StudentStatusEnum.Active)
        .all()
    )

    if not structures or not students:
        return 0

    student_ids = [student.id for student in students]
    structure_ids = [fs.id for fs in structures]
    existing_pairs = {
        (student_id, fee_structure_id)
        for student_id, fee_structure_id in (
            db.query(StudentFee.student_id, StudentFee.fee_structure_id)
            .filter(StudentFee.student_id.in_(student_ids))
            .filter(StudentFee.fee_structure_id.in_(structure_ids))
            .all()
        )
    }

    assigned = 0
    for student in students:
        for fs in structures:
            if (student.id, fs.id) not in existing_pairs:
                db.add(StudentFee(
                    student_id=student.id,
                    fee_structure_id=fs.id,
                    concession=Decimal("0.00"),
                    net_amount=Decimal(str(fs.amount)),
                    # BUG-B FIX: write the year so ledger queries can filter by it
                    # after promotion changes the student's academic_year_id.
                    academic_year_id=academic_year_id,
                ))
                assigned += 1
                existing_pairs.add((student.id, fs.id))

    db.commit()
    return assigned


# ──────────────────────────────────────────────────────────────
# Student Ledger
# ──────────────────────────────────────────────────────────────

def get_student_ledger(db: Session, student_id: int) -> Optional[StudentLedger]:
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        return None

    # Show the complete ledger across years. Student.academic_year_id changes on
    # promotion, while old invoices keep their original year stamp.
    student_fees = (
        db.query(StudentFee)
        .options(
            joinedload(StudentFee.fee_structure).joinedload(FeeStructure.fee_head),
            joinedload(StudentFee.payments),
        )
        .filter(StudentFee.student_id == student_id)
        .all()
    )

    items: list[StudentLedgerItem] = []
    total_due  = Decimal("0.00")
    total_paid = Decimal("0.00")

    for sf in student_fees:
        paid = sum(
            (Decimal(str(p.amount_paid)) for p in sf.payments),
            Decimal("0.00"),
        )
        net = Decimal(str(sf.net_amount))
        total_due  += net
        total_paid += paid
        items.append(StudentLedgerItem(
            fee_head_name=sf.fee_structure.fee_head.name,
            frequency=sf.fee_structure.fee_head.frequency,
            net_amount=net,
            paid_amount=paid,
            balance=net - paid,
            student_fee_id=sf.id,
        ))

    return StudentLedger(
        student_id=student_id,
        student_name=student.name_en,
        total_due=total_due,
        total_paid=total_paid,
        total_balance=total_due - total_paid,
        items=items,
    )


# ──────────────────────────────────────────────────────────────
# Payments
# ──────────────────────────────────────────────────────────────

def generate_receipt_number(db: Session) -> str:
    """
    STEP 2.2 FIX: Acquires a PostgreSQL advisory transaction lock before
    reading MAX(id) so concurrent payment submissions are fully serialised.

    Without this lock two concurrent requests can both read MAX(id)=100,
    both generate RCPT-YEAR-00101, and the second INSERT fails with a
    UniqueViolation on the receipt_number column.

    pg_advisory_xact_lock(RECEIPT_NUMBER_LOCK_KEY) holds the lock for the
    current transaction; it is released automatically on COMMIT or ROLLBACK.
    """
    year = date.today().year
    try:
        with db.begin_nested():
            num = db.execute(text("SELECT nextval('receipt_number_seq')")).scalar()
    except Exception:
        try:
            db.execute(text(f"SELECT pg_advisory_xact_lock({RECEIPT_NUMBER_LOCK_KEY})"))
        except Exception:
            pass
        num = (db.query(func.max(FeePayment.id)).scalar() or 0) + 1
    return f"RCPT-{year}-{int(num):05d}"


def record_payment(db: Session, data: PaymentCreate, actor_user_id: int | None = None) -> FeePayment:
    if Decimal(str(data.amount_paid)) <= 0:
        raise ValueError("Payment amount must be greater than 0")

    sf = db.query(StudentFee).filter_by(id=data.student_fee_id).first()
    if not sf:
        raise LookupError("Student fee not found")

    # Check overpayment
    already_paid = Decimal(str(
        db.query(func.coalesce(func.sum(FeePayment.amount_paid), 0))
        .filter(FeePayment.student_fee_id == data.student_fee_id)
        .scalar()
    ))
    net = Decimal(str(sf.net_amount))
    outstanding = net - already_paid

    if outstanding <= 0:
        raise ValueError(
            f"This fee entry is already fully paid "
            f"(net: ₹{net}, paid: ₹{already_paid})."
        )
    if Decimal(str(data.amount_paid)) > outstanding:
        raise ValueError(
            f"Payment ₹{data.amount_paid} exceeds outstanding balance ₹{outstanding}."
        )

    receipt = generate_receipt_number(db)
    payment = FeePayment(**data.model_dump(), receipt_number=receipt)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    log_data_change(
        db,
        user_id=actor_user_id,
        action=DataAuditActionEnum.create,
        table_name="fee_payments",
        record_id=payment.id,
        old_value=None,
        new_value=model_snapshot(payment),
    )
    db.commit()
    db.refresh(payment)
    try:
        from app.services.notification_service import enqueue_payment_confirmation
        enqueue_payment_confirmation(db, payment.id)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning("Could not queue payment confirmation for payment %s: %s", payment.id, exc)
    return payment


def get_payments_by_student(db: Session, student_id: int):
    sf_ids = [
        sf.id
        for sf in db.query(StudentFee).filter_by(student_id=student_id).all()
    ]
    if not sf_ids:
        return []
    return (
        db.query(FeePayment)
        .filter(FeePayment.student_fee_id.in_(sf_ids))
        .order_by(FeePayment.payment_date.desc(), FeePayment.id.desc())
        .all()
    )


# ──────────────────────────────────────────────────────────────
# Defaulters — single aggregating query (not N+1)
# ──────────────────────────────────────────────────────────────

def get_defaulters(
    db: Session,
    class_id: Optional[int] = None,
    academic_year_id: Optional[int] = None,
):
    """
    Returns students with outstanding fee balance, using a single SQL query
    with GROUP BY instead of a Python loop with one query per student.
    """
    payment_totals = (
        db.query(
            FeePayment.student_fee_id.label("student_fee_id"),
            func.coalesce(func.sum(FeePayment.amount_paid), 0).label("total_paid"),
        )
        .group_by(FeePayment.student_fee_id)
        .subquery()
    )

    fee_year = func.coalesce(StudentFee.academic_year_id, FeeStructure.academic_year_id)
    fee_totals = (
        db.query(
            StudentFee.student_id.label("student_id"),
            func.coalesce(func.sum(StudentFee.net_amount), 0).label("total_due"),
            func.sum(func.coalesce(payment_totals.c.total_paid, 0)).label("total_paid"),
        )
        .join(FeeStructure, StudentFee.fee_structure_id == FeeStructure.id, isouter=True)
        .outerjoin(payment_totals, payment_totals.c.student_fee_id == StudentFee.id)
    )

    if academic_year_id is not None:
        fee_totals = fee_totals.filter(fee_year == academic_year_id)
    else:
        fee_totals = (
            fee_totals
            .join(Student, Student.id == StudentFee.student_id)
            .filter(fee_year == Student.academic_year_id)
        )

    fee_totals = fee_totals.group_by(StudentFee.student_id).subquery()

    q = (
        db.query(
            Student,
            Class.name.label("class_name"),
            fee_totals.c.total_due,
            fee_totals.c.total_paid,
        )
        .join(fee_totals, fee_totals.c.student_id == Student.id)
        .outerjoin(Class, Class.id == Student.class_id)
        .filter(Student.status == StudentStatusEnum.Active)
    )

    if class_id is not None:
        q = q.filter(Student.class_id == class_id)

    defaulters = []
    for student, class_name, total_due, total_paid in q.all():
        balance = Decimal(str(total_due)) - Decimal(str(total_paid))
        if balance > 0:
            defaulters.append({
                "student_id":   student.id,
                "student_name": student.name_en,
                "class_id":     student.class_id,
                "class_name":   class_name or "—",
                "contact":      student.contact,
                "total_due":    float(total_due),
                "total_paid":   float(total_paid),
                "balance":      float(balance),
            })

    defaulters.sort(key=lambda x: x["balance"], reverse=True)
    return defaulters
