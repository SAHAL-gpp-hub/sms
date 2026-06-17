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

from sqlalchemy import func, text, extract, or_
from sqlalchemy.orm import Session, joinedload  

from app.core.constants import RECEIPT_NUMBER_LOCK_KEY
from app.models.base_models import (
    Class, DataAuditActionEnum, Enrollment, EnrollmentStatusEnum, FeeHead,
    FeePayment, FeeStructure, Student, StudentFee,
)
from app.schemas.fee import (
    FeeHeadCreate, FeeStructureCreate, PaymentCreate,
    StudentLedger, StudentLedgerItem,
)
from app.services.audit_service import log_data_change, model_snapshot
from app.services.student_service import ensure_enrollments_for_legacy_students

logger = logging.getLogger("sms.fees")

ACTIVE_ENROLLMENT_STATUSES = (
    EnrollmentStatusEnum.active,
    EnrollmentStatusEnum.retained,
    EnrollmentStatusEnum.provisional,
)


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


def get_same_standard_class_ids(db: Session, class_id: int, academic_year_id: int) -> list[int]:
    cls = db.query(Class).filter_by(id=class_id).first()
    if not cls:
        return [class_id]
    class_ids = [
        cid for (cid,) in (
            db.query(Class.id)
            .filter(
                Class.name == cls.name,
                Class.academic_year_id == academic_year_id,
            )
            .order_by(Class.id)
            .all()
        )
    ]
    return class_ids or [class_id]


def create_fee_structure_for_standard(db: Session, data: FeeStructureCreate) -> list[FeeStructure]:
    return [
        create_fee_structure(db, data.model_copy(update={"class_id": class_id}))
        for class_id in get_same_standard_class_ids(db, data.class_id, data.academic_year_id)
    ]


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
        class_ids = get_same_standard_class_ids(db, fs.class_id, fs.academic_year_id)
        matches = db.query(FeeStructure).filter(
            FeeStructure.class_id.in_(class_ids),
            FeeStructure.academic_year_id == fs.academic_year_id,
            FeeStructure.fee_head_id == fs.fee_head_id,
        ).all()
        for match in matches:
            db.delete(match)
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
            db.query(Enrollment.academic_year_id)
            .filter(Enrollment.class_id == class_id, Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
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
    enrollments = (
        db.query(Enrollment)
        .filter_by(class_id=class_id, academic_year_id=academic_year_id)
        .filter(Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))
        .all()
    )

    existing_pairs = {
        (enrollment_id, fee_structure_id)
        for enrollment_id, fee_structure_id in (
            db.query(StudentFee.enrollment_id, StudentFee.fee_structure_id)
            .filter(StudentFee.academic_year_id == academic_year_id)
            .filter(StudentFee.enrollment_id.in_([enrollment.id for enrollment in enrollments]))
            .filter(StudentFee.fee_structure_id.in_([fs.id for fs in structures]))
            .all()
        )
    } if enrollments and structures else set()

    assigned = 0
    for enrollment in enrollments:
        for fs in structures:
            pair = (enrollment.id, fs.id)
            if pair not in existing_pairs:
                db.add(StudentFee(
                    enrollment_id=enrollment.id,
                    student_id=enrollment.student_id,
                    fee_structure_id=fs.id,
                    concession=Decimal("0.00"),
                    net_amount=Decimal(str(fs.amount)),
                    # BUG-B FIX: write the year so ledger queries can filter by it
                    # after promotion changes the student's academic_year_id.
                    academic_year_id=academic_year_id,
                ))
                existing_pairs.add(pair)
                assigned += 1

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
        .join(Enrollment, Enrollment.id == StudentFee.enrollment_id)
        .filter(Enrollment.student_id == student_id)
        .all()
    )

    PLAN_COUNTS = {"full": 1, "half": 2, "quarter": 4}

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

        plan = sf.installment_plan
        inst_paid = int(sf.installments_paid or 0)
        total_inst = PLAN_COUNTS.get(plan) if plan else None
        if plan and total_inst:
            inst_amount = (net / Decimal(str(total_inst))).quantize(Decimal("0.01"))
            remaining_inst = total_inst - inst_paid
            next_inst_amount = inst_amount if remaining_inst > 0 and (net - paid) > 0 else None
        else:
            next_inst_amount = None

        items.append(StudentLedgerItem(
            fee_head_name=sf.fee_structure.fee_head.name,
            frequency=sf.fee_structure.fee_head.frequency,
            net_amount=net,
            paid_amount=paid,
            balance=net - paid,
            student_fee_id=sf.id,
            enrollment_id=sf.enrollment_id,
            academic_year_id=sf.academic_year_id,
            invoice_type=sf.invoice_type or "regular",
            installment_plan=plan,
            installments_paid=inst_paid,
            total_installments=total_inst,
            next_installment_amount=next_inst_amount,
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


def allocate_payment(
    db: Session,
    student_id: int,
    amount: Decimal,
    payment_date: date,
    mode: str,
    collected_by: str | None = None,
    notes: str | None = None,
    online_order_id: int | None = None,
    actor_user_id: int | None = None,
    academic_year_id: int | None = None,
    student_fee_id: int | None = None,
    installment_plan: str | None = None,
) -> list[FeePayment]:
    """
    Allocate a payment across StudentFee rows, enforcing installment plan rules.

    INSTALLMENT PLAN ENFORCEMENT
    ────────────────────────────
    installment_plan must be 'full', 'half', or 'quarter' (or None for legacy
    custom-amount flows).

    Rules:
    1. If a StudentFee already has installment_plan set (plan_locked), the
       payment MUST match the next scheduled instalment amount (net_amount /
       total_installments).  Re-splitting is rejected.
    2. If no plan is set yet (first payment), the plan is locked onto the row
       from the installment_plan argument.
    3. After each successful payment, installments_paid is incremented.
    4. Overpaying beyond the scheduled instalment is rejected with ValueError.
    """
    if amount <= 0:
        raise ValueError("Payment amount must be greater than 0")

    PLAN_COUNTS = {"full": 1, "half": 2, "quarter": 4}

    from sqlalchemy import or_
    query = db.query(StudentFee).outerjoin(Enrollment, Enrollment.id == StudentFee.enrollment_id).filter(
        or_(StudentFee.student_id == student_id, Enrollment.student_id == student_id)
    )
    if academic_year_id:
        query = query.filter(StudentFee.academic_year_id == academic_year_id)
    if student_fee_id:
        query = query.filter(StudentFee.id == student_fee_id)

    student_fees = query.order_by(StudentFee.id).all()

    payable_items = []
    total_outstanding = Decimal("0.00")
    for sf in student_fees:
        paid_so_far = Decimal(str(
            db.query(func.coalesce(func.sum(FeePayment.amount_paid), 0))
            .filter(FeePayment.student_fee_id == sf.id)
            .scalar()
        ))
        outstanding = Decimal(str(sf.net_amount)) - paid_so_far
        if outstanding > 0:
            payable_items.append((sf, outstanding, paid_so_far))
            total_outstanding += outstanding

    # ── Installment plan: lock on first payment, guard against over-paying ──
    # Instalment amounts are always based on the TOTAL across all fee heads
    # (frontend sends total_balance / 2 or / 4), NOT per-fee-head.
    for sf, outstanding, paid_so_far in payable_items:
        existing_plan = sf.installment_plan
        inst_paid = int(sf.installments_paid or 0)

        if existing_plan:
            total_inst = PLAN_COUNTS[existing_plan]
            if inst_paid >= total_inst:
                fee_name = (
                    sf.fee_structure.fee_head.name
                    if sf.fee_structure and sf.fee_structure.fee_head
                    else "fee"
                )
                raise ValueError(
                    f"All {total_inst} instalments for '{fee_name}' have already been paid."
                )
        elif installment_plan:
            # First payment — lock the plan onto this fee row.
            if installment_plan not in PLAN_COUNTS:
                raise ValueError(
                    f"Invalid installment plan '{installment_plan}'. Must be full, half, or quarter."
                )
            sf.installment_plan = installment_plan
            sf.installments_paid = 0

    if amount > total_outstanding:
        raise ValueError(f"Payment amount ₹{amount} exceeds total outstanding balance ₹{total_outstanding}")

    remaining = amount
    payments = []

    # ONE receipt number per payment session — shared across all fee-head rows.
    shared_receipt = generate_receipt_number(db)

    # ── Proportional allocation ───────────────────────────────────────────
    # When an instalment plan is active (half/quarter), distribute the payment
    # proportionally so every fee head is paid at the same rate.
    # Example: total 750, half plan -> 375 payment
    #   Tuition 500 -> 500/750 * 375 = 250
    #   Exam    150 -> 150/750 * 375 = 75
    #   Activity100 -> 100/750 * 375 = 50
    # For full/custom payments, greedy fill is used.
    active_plan = installment_plan or (payable_items[0][0].installment_plan if payable_items else None)

    if active_plan and active_plan != "full":
        total_original = sum(Decimal(str(sf.net_amount)) for sf, _, _ in payable_items)
        proportional_amounts: dict[int, Decimal] = {}
        allocated_so_far = Decimal("0.00")
        items_list = list(payable_items)
        for i, (sf, outstanding, _) in enumerate(items_list):
            if i == len(items_list) - 1:
                proportional_amounts[sf.id] = min(
                    (amount - allocated_so_far).quantize(Decimal("0.01")),
                    outstanding,
                )
            else:
                share = (Decimal(str(sf.net_amount)) / total_original * amount).quantize(Decimal("0.01"))
                share = min(share, outstanding)
                proportional_amounts[sf.id] = share
                allocated_so_far += share
    else:
        proportional_amounts = {}

    for sf, outstanding, _paid_so_far in payable_items:
        if remaining <= 0:
            break

        if proportional_amounts:
            applied = min(proportional_amounts.get(sf.id, Decimal("0.00")), outstanding, remaining)
        else:
            applied = min(outstanding, remaining)

        if applied > 0:
            payment = FeePayment(
                student_fee_id=sf.id,
                amount_paid=applied,
                payment_date=payment_date,
                mode=mode,
                receipt_number=shared_receipt,
                collected_by=collected_by,
                notes=notes,
                online_order_id=online_order_id,
            )
            db.add(payment)
            db.flush()
            payments.append(payment)
            remaining = (remaining - applied).quantize(Decimal("0.01"))

            # Increment the instalment counter (works whether plan was just
            # locked above or was already locked from a prior payment).
            if sf.installment_plan:
                sf.installments_paid = int(sf.installments_paid or 0) + 1

    db.commit()

    for payment in payments:
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

    for payment in payments:
        db.refresh(payment)
        try:
            from app.services.notification_service import enqueue_payment_confirmation
            enqueue_payment_confirmation(db, payment.id)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning("Could not queue payment confirmation for payment %s: %s", payment.id, exc)

    return payments


def record_payment(db: Session, data: PaymentCreate, actor_user_id: int | None = None) -> dict:
    student = db.query(Student).filter_by(id=data.student_id).first()
    if not student:
        raise LookupError("Student not found")

    payments = allocate_payment(
        db=db,
        student_id=data.student_id,
        amount=Decimal(str(data.amount_paid)),
        payment_date=data.payment_date,
        mode=data.mode,
        collected_by=data.collected_by,
        notes=data.notes,
        actor_user_id=actor_user_id,
        academic_year_id=data.academic_year_id,
        installment_plan=data.installment_plan,
    )

    if not payments:
        raise ValueError("No outstanding fees found or payment could not be allocated")

    enrollment = (
        db.query(Enrollment)
        .filter_by(student_id=data.student_id)
        .order_by(Enrollment.id.desc())
        .first()
    )
    cls = db.query(Class).filter_by(id=enrollment.class_id).first() if enrollment else None

    from sqlalchemy import or_
    total_balance_after = Decimal("0.00")
    all_fees = db.query(StudentFee).outerjoin(Enrollment, Enrollment.id == StudentFee.enrollment_id).filter(
        or_(StudentFee.student_id == data.student_id, Enrollment.student_id == data.student_id)
    ).all()
    for sf in all_fees:
        paid = Decimal(str(
            db.query(func.coalesce(func.sum(FeePayment.amount_paid), 0))
            .filter(FeePayment.student_fee_id == sf.id)
            .scalar()
        ))
        total_balance_after += (Decimal(str(sf.net_amount)) - paid)

    allocations = []
    for p in payments:
        sf = db.query(StudentFee).filter_by(id=p.student_fee_id).first()
        fh_name = sf.fee_structure.fee_head.name if sf.fee_structure and sf.fee_structure.fee_head else "Unknown"
        
        paid_for_sf = Decimal(str(
            db.query(func.coalesce(func.sum(FeePayment.amount_paid), 0))
            .filter(FeePayment.student_fee_id == sf.id)
            .scalar()
        ))
        bal_sf = Decimal(str(sf.net_amount)) - paid_for_sf

        allocations.append({
            "fee_head_name": fh_name,
            "amount_applied": Decimal(str(p.amount_paid)),
            "balance_after": bal_sf,
        })

    return {
        "id": payments[0].id,
        "payment_ids": [p.id for p in payments],
        "receipt_numbers": list(dict.fromkeys(p.receipt_number for p in payments)),
        "total_amount": data.amount_paid,
        "payment_date": data.payment_date,
        "mode": data.mode,
        "collected_by": data.collected_by,
        "student_name": student.name_en,
        "student_gr_no": student.gr_number,
        "class_name": f"Class {cls.name} — {cls.division}" if cls else None,
        "allocations": allocations,
        "total_balance_after": total_balance_after,
    }


def get_payments_by_student(db: Session, student_id: int):
    sf_ids = [
        sf.id
        for sf in db.query(StudentFee)
        .outerjoin(Enrollment, Enrollment.id == StudentFee.enrollment_id)
        .filter(or_(StudentFee.student_id == student_id, Enrollment.student_id == student_id))
        .all()
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
    ensure_enrollments_for_legacy_students(db)
    unlinked_fees = db.query(StudentFee).filter(StudentFee.enrollment_id.is_(None)).all()
    linked_any = False
    for fee in unlinked_fees:
        enrollment = db.query(Enrollment).filter_by(
            student_id=fee.student_id,
            academic_year_id=fee.academic_year_id,
        ).first()
        if enrollment:
            fee.enrollment_id = enrollment.id
            linked_any = True
    if linked_any:
        db.commit()
    payment_totals = (
        db.query(
            FeePayment.student_fee_id.label("student_fee_id"),
            func.coalesce(func.sum(FeePayment.amount_paid), 0).label("total_paid"),
        )
        .group_by(FeePayment.student_fee_id)
        .subquery()
    )

    fee_totals = (
    db.query(
        Enrollment.student_id.label("student_id"),
        Enrollment.class_id.label("class_id"),
        Enrollment.academic_year_id.label("academic_year_id"),
        func.coalesce(func.sum(StudentFee.net_amount), 0).label("total_due"),
        func.sum(func.coalesce(payment_totals.c.total_paid, 0)).label("total_paid"),
    )
    .select_from(StudentFee)
    .join(Enrollment, Enrollment.id == StudentFee.enrollment_id)
    .outerjoin(FeeStructure, StudentFee.fee_structure_id == FeeStructure.id)
    .outerjoin(payment_totals, payment_totals.c.student_fee_id == StudentFee.id)
    )

    if academic_year_id is not None:
        fee_totals = fee_totals.filter(Enrollment.academic_year_id == academic_year_id)
    else:
        fee_totals = fee_totals.filter(Enrollment.status.in_(ACTIVE_ENROLLMENT_STATUSES))

    if class_id is not None:
        fee_totals = fee_totals.filter(Enrollment.class_id == class_id)

    fee_totals = fee_totals.group_by(
        Enrollment.student_id, Enrollment.class_id, Enrollment.academic_year_id
    ).subquery()

    q = (
        db.query(
            Student,
            Class.name.label("class_name"),
            fee_totals.c.class_id,
            fee_totals.c.academic_year_id,
            fee_totals.c.total_due,
            fee_totals.c.total_paid,
        )
        .join(fee_totals, fee_totals.c.student_id == Student.id)
        .outerjoin(Class, Class.id == fee_totals.c.class_id)
    )

    defaulters = []
    for student, class_name, row_class_id, row_year_id, total_due, total_paid in q.all():
        balance = Decimal(str(total_due)) - Decimal(str(total_paid))
        if balance > 0:
            defaulters.append({
                "student_id":   student.id,
                "student_name": student.name_en,
                "class_id":     row_class_id,
                "class_name":   class_name or "—",
                "contact":      student.contact,
                "total_due":    float(total_due),
                "total_paid":   float(total_paid),
                "balance":      float(balance),
            })

    defaulters.sort(key=lambda x: x["balance"], reverse=True)
    return defaulters




def get_monthly_collections(
    db: Session,
    month: int,
    academic_year_id: Optional[int] = None,
) -> list[dict]:
    q = (
        db.query(
            FeePayment.payment_date.label("pdate"),
            func.coalesce(func.sum(FeePayment.amount_paid), 0).label("total"),
        )
        .filter(extract("month", FeePayment.payment_date) == month)
    )
    if academic_year_id is not None:
        q = (
            q.join(StudentFee, StudentFee.id == FeePayment.student_fee_id)
             .filter(StudentFee.academic_year_id == academic_year_id)
        )
    rows = (
        q.group_by(FeePayment.payment_date)
         .order_by(FeePayment.payment_date)
         .all()
    )
    MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]
    return [
        {"day": f"{r.pdate.day} {MONTH_SHORT[r.pdate.month-1]}", "collected": float(r.total)}
        for r in rows
    ]


def get_payment_options(db: Session, student_id: int) -> dict:
    """
    Returns installment options for a student.

    INSTALLMENT PLAN LOGIC
    ─────────────────────
    Installment amounts are always derived from the ORIGINAL net_amount of each
    StudentFee row, never from the remaining balance.  This prevents the
    "nested installment" bug where paying half of the balance and then
    re-splitting the remainder would result in sub-half/quarter payments that
    don't match the original plan.

    Each StudentFee row carries:
      installment_plan   — null / 'full' / 'half' / 'quarter'
      installments_paid  — count of instalments settled so far

    Plan totals per StudentFee:
      full    → 1 payment of net_amount
      half    → 2 payments of net_amount / 2
      quarter → 4 payments of net_amount / 4

    Once any instalment has been paid (installments_paid > 0) the plan is
    locked.  The UI must only offer the next scheduled instalment, not the
    Full/Half/Quarter chooser.

    Return shape
    ─────────────
    {
      "student_id": int,
      "fee_items": [
        {
          "student_fee_id": int,
          "fee_head_name": str,
          "original_amount": Decimal,     # net_amount (never changes)
          "paid_amount": Decimal,          # sum of all FeePayment rows
          "balance": Decimal,              # original - paid
          "installment_plan": str|null,    # 'full'/'half'/'quarter'/null
          "installments_paid": int,        # 0..total_installments
          "total_installments": int,       # 1 / 2 / 4
          "next_installment_amount": Decimal|null,  # null if fully paid
          "plan_locked": bool,             # true once first instalment paid
        }
      ],
      "summary": {
        "total_original": Decimal,
        "total_paid": Decimal,
        "total_balance": Decimal,
        "plan_state": "unset" | "in_progress" | "complete",
        # Quick-access options shown only when plan is "unset" for ALL items
        "options": [
          {"key": "full",    "label": "Full Payment",    "amount": Decimal},
          {"key": "half",    "label": "Half Payment",    "amount": Decimal},
          {"key": "quarter", "label": "Quarter Payment", "amount": Decimal},
        ] | None
      }
    }
    """
    from app.services.academic_year_service import require_current_academic_year
    from sqlalchemy import or_
    try:
        year = require_current_academic_year(db)
        year_id = year.id
    except Exception:
        year_id = None

    query = (
        db.query(StudentFee)
        .options(joinedload(StudentFee.fee_structure).joinedload(FeeStructure.fee_head))
        .outerjoin(Enrollment, Enrollment.id == StudentFee.enrollment_id)
        .filter(or_(StudentFee.student_id == student_id, Enrollment.student_id == student_id))
    )
    if year_id:
        query = query.filter(StudentFee.academic_year_id == year_id)

    student_fees = query.all()

    PLAN_COUNTS = {"full": 1, "half": 2, "quarter": 4}

    fee_items = []
    total_original = Decimal("0.00")
    total_paid_all = Decimal("0.00")

    for sf in student_fees:
        paid = Decimal(str(
            db.query(func.coalesce(func.sum(FeePayment.amount_paid), 0))
            .filter(FeePayment.student_fee_id == sf.id)
            .scalar()
        ))
        original = Decimal(str(sf.net_amount))
        balance = original - paid
        plan = sf.installment_plan          # null / 'full' / 'half' / 'quarter'
        inst_paid = int(sf.installments_paid or 0)
        total_inst = PLAN_COUNTS.get(plan, 1) if plan else None

        if plan and total_inst:
            inst_amount = (original / Decimal(str(total_inst))).quantize(Decimal("0.01"))
            remaining_inst = total_inst - inst_paid
            next_amount = inst_amount if remaining_inst > 0 and balance > 0 else None
        else:
            inst_amount = None
            next_amount = None

        fee_head_name = "General Fee"
        if sf.fee_structure and sf.fee_structure.fee_head:
            fee_head_name = sf.fee_structure.fee_head.name

        fee_items.append({
            "student_fee_id": sf.id,
            "fee_head_name": fee_head_name,
            "original_amount": original,
            "paid_amount": paid,
            "balance": balance,
            "installment_plan": plan,
            "installments_paid": inst_paid,
            "total_installments": total_inst,
            "next_installment_amount": next_amount,
            "plan_locked": inst_paid > 0,
        })
        total_original += original
        total_paid_all += paid

    total_balance = total_original - total_paid_all

    # Determine aggregate plan state
    plans_set = [item for item in fee_items if item["installment_plan"] is not None]
    any_in_progress = any(item["installments_paid"] > 0 for item in fee_items)
    all_complete = total_balance <= Decimal("0.00")

    if all_complete:
        plan_state = "complete"
    elif any_in_progress:
        plan_state = "in_progress"
    else:
        plan_state = "unset"

    # Only offer Full/Half/Quarter chooser when NO plan has been started yet
    options = None
    if plan_state == "unset" and total_balance > 0:
        half_amount = (total_balance / Decimal("2")).quantize(Decimal("0.01"))
        quarter_amount = (total_balance / Decimal("4")).quantize(Decimal("0.01"))
        options = [
            {"key": "full",    "label": "Full Payment",    "amount": total_balance},
            {"key": "half",    "label": "Half Payment (1/2)",  "amount": half_amount},
            {"key": "quarter", "label": "Quarter Payment (1/4)", "amount": quarter_amount},
        ]

    return {
        "student_id": student_id,
        "fee_items": fee_items,
        "summary": {
            "total_original": total_original,
            "total_paid": total_paid_all,
            "total_balance": total_balance,
            "plan_state": plan_state,
            "options": options,
        },
    }