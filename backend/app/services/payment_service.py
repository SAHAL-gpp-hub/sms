import hashlib
import hmac
import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.base_models import Enrollment, FeePayment, OnlinePaymentOrder, StudentFee
from app.routers.auth import CurrentUser, ensure_student_access
from app.services.academic_year_service import require_current_academic_year
from app.services.fee_service import generate_receipt_number
from app.models.base_models import DataAuditActionEnum
from app.services.audit_service import log_data_change, model_snapshot

logger = logging.getLogger("sms.payments")


def _money(value: Decimal | int | str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _to_paise(value: Decimal) -> int:
    return int((_money(value) * Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP))


def _require_razorpay_config() -> None:
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        )


def _outstanding_for_student_fee(db: Session, student_fee: StudentFee) -> Decimal:
    paid = Decimal(str(
        db.query(func.coalesce(func.sum(FeePayment.amount_paid), 0))
        .filter(FeePayment.student_fee_id == student_fee.id)
        .scalar()
    ))
    return _money(Decimal(str(student_fee.net_amount)) - paid)


def _get_accessible_student_fee(db: Session, user: CurrentUser, student_fee_id: int) -> StudentFee:
    student_fee = db.query(StudentFee).filter_by(id=student_fee_id).first()
    if not student_fee:
        raise HTTPException(status_code=404, detail="Fee record not found")
    ensure_student_access(db, user, student_fee.student_id)
    return student_fee


def _student_id_for_order(db: Session, order: OnlinePaymentOrder) -> int:
    if order.student_id:
        return order.student_id
    if order.student_fee_id:
        student_fee = db.query(StudentFee).filter_by(id=order.student_fee_id).first()
        if not student_fee:
            raise HTTPException(status_code=404, detail="Fee record not found")
        return student_fee.student_id
    raise HTTPException(status_code=404, detail="Payment order is not linked to a student")


def _receipt_summary(payments: list[FeePayment]) -> str:
    receipts = [p.receipt_number for p in payments if p.receipt_number]
    if not receipts:
        return ""
    if len(receipts) == 1:
        return receipts[0]
    return f"{receipts[0]} + {len(receipts) - 1} more"


def get_order_receipt_summary(db: Session, order_id: int) -> str | None:
    payments = (
        db.query(FeePayment)
        .filter(FeePayment.online_order_id == order_id)
        .order_by(FeePayment.id)
        .all()
    )
    return _receipt_summary(payments) or None


def _current_year_fee_items(db: Session, student_id: int) -> list[StudentFee]:
    year = require_current_academic_year(db)
    return (
        db.query(StudentFee)
        .outerjoin(Enrollment, Enrollment.id == StudentFee.enrollment_id)
        .filter(
            or_(StudentFee.student_id == student_id, Enrollment.student_id == student_id),
            StudentFee.academic_year_id == year.id,
            StudentFee.invoice_type != "arrear",
        )
        .order_by(StudentFee.id)
        .all()
    )


def _current_year_outstanding(db: Session, student_id: int) -> tuple[list[StudentFee], Decimal]:
    items = _current_year_fee_items(db, student_id)
    total = Decimal("0.00")
    payable: list[StudentFee] = []
    for item in items:
        outstanding = _outstanding_for_student_fee(db, item)
        if outstanding > 0:
            payable.append(item)
            total += outstanding
    return payable, _money(total)


def _create_gateway_order(
    *,
    amount: Decimal,
    receipt: str,
    notes: dict[str, str],
) -> dict[str, Any]:
    try:
        import razorpay
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Razorpay SDK is not installed") from exc

    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    return client.order.create({
        "amount": _to_paise(amount),
        "currency": "INR",
        "receipt": receipt,
        "notes": notes,
    })


def verify_checkout_signature(order_id: str, payment_id: str, signature: str) -> None:
    _require_razorpay_config()
    if not signature:
        raise HTTPException(status_code=400, detail="Missing payment signature")
    payload = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, str(signature)):
        raise HTTPException(status_code=400, detail="Payment signature verification failed")


def verify_webhook_signature(body: bytes, signature: str | None) -> None:
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Razorpay webhook secret is not configured")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing Razorpay webhook signature")
    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, str(signature)):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")


def _fail_order(db: Session, order: OnlinePaymentOrder, reason: str) -> None:
    order.status = "failed"
    order.failure_reason = reason
    db.commit()


def mark_order_paid_from_webhook(
    db: Session,
    order: OnlinePaymentOrder,
    payment_entity: dict[str, Any],
) -> list[FeePayment]:
    payment_id = payment_entity.get("id")
    if not payment_id:
        raise HTTPException(status_code=400, detail="Webhook payment id is missing")

    if payment_entity.get("status") != "captured":
        reason = "Webhook payment is not captured"
        _fail_order(db, order, reason)
        raise HTTPException(status_code=400, detail=reason)

    expected_amount = _to_paise(Decimal(str(order.amount)))
    if payment_entity.get("amount") != expected_amount:
        reason = "Webhook payment amount does not match the order amount"
        _fail_order(db, order, reason)
        raise HTTPException(status_code=400, detail=reason)

    if payment_entity.get("currency") != order.currency:
        reason = "Webhook payment currency does not match the order currency"
        _fail_order(db, order, reason)
        raise HTTPException(status_code=400, detail=reason)

    return mark_order_paid(db, order, payment_id)


def create_razorpay_order(db: Session, user: CurrentUser, student_fee_id: int, amount: Decimal) -> dict[str, Any]:
    _require_razorpay_config()
    student_fee = _get_accessible_student_fee(db, user, student_fee_id)
    amount = _money(amount)
    outstanding = _outstanding_for_student_fee(db, student_fee)
    if outstanding <= 0:
        raise HTTPException(status_code=400, detail="This fee is already fully paid")
    if amount > outstanding:
        raise HTTPException(status_code=400, detail=f"Amount exceeds outstanding balance of ₹{outstanding}")

    order = _create_gateway_order(
        amount=amount,
        receipt=f"sf_{student_fee_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        notes={
            "student_fee_id": str(student_fee_id),
            "student_id": str(student_fee.student_id),
            "student_name": student_fee.student.name_en if student_fee.student else "",
        },
    )

    db_order = OnlinePaymentOrder(
        student_fee_id=student_fee_id,
        student_id=student_fee.student_id,
        scope="single_fee",
        razorpay_order_id=order["id"],
        amount=amount,
        currency=order.get("currency", "INR"),
        status="created",
    )
    db.add(db_order)
    db.commit()

    student = student_fee.student
    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order.get("currency", "INR"),
        "key_id": settings.RAZORPAY_KEY_ID,
        "student_name": student.name_en if student else "",
        "contact": student.contact if student else None,
        "email": student.guardian_email if student else None,
    }


def create_current_year_order(
    db: Session,
    user: CurrentUser,
    student_id: int,
    amount: Decimal,
    payment_option: str | None = None,
) -> dict[str, Any]:
    _require_razorpay_config()
    student = ensure_student_access(db, user, student_id)
    amount = _money(amount)
    payable_items, outstanding = _current_year_outstanding(db, student_id)
    if not payable_items or outstanding <= 0:
        raise HTTPException(status_code=400, detail="Current-year fees are already fully paid")
    if amount > outstanding:
        raise HTTPException(status_code=400, detail=f"Amount exceeds current-year outstanding balance of ₹{outstanding}")

    order = _create_gateway_order(
        amount=amount,
        receipt=f"cy_{student_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        notes={
            "student_id": str(student_id),
            "student_name": student.name_en if student else "",
            "scope": "current_year",
            "payment_option": payment_option or "",
        },
    )

    db_order = OnlinePaymentOrder(
        student_id=student_id,
        scope="current_year",
        payment_option=payment_option,
        razorpay_order_id=order["id"],
        amount=amount,
        currency=order.get("currency", "INR"),
        status="created",
    )
    db.add(db_order)
    db.commit()

    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order.get("currency", "INR"),
        "key_id": settings.RAZORPAY_KEY_ID,
        "student_name": student.name_en if student else "",
        "contact": student.contact if student else None,
        "email": student.guardian_email if student else None,
    }


def mark_order_paid(
    db: Session,
    order: OnlinePaymentOrder,
    payment_id: str,
    signature: str | None = None,
    actor_user_id: int | None = None,
) -> list[FeePayment]:
    existing_payments = (
        db.query(FeePayment)
        .filter_by(online_order_id=order.id)
        .order_by(FeePayment.id)
        .all()
    )
    if existing_payments:
        if order.status != "paid":
            order.razorpay_payment_id = payment_id
            order.razorpay_signature = signature
            order.status = "paid"
            order.paid_at = datetime.now(timezone.utc)
            db.commit()
        return existing_payments

    if order.status == "paid":
        raise HTTPException(status_code=409, detail="Order is paid but receipt is missing")

    amount = _money(order.amount)
    allocations: list[tuple[StudentFee, Decimal]]
    if order.scope == "current_year":
        if not order.student_id:
            raise HTTPException(status_code=404, detail="Payment order is not linked to a student")
        payable_items, outstanding = _current_year_outstanding(db, order.student_id)
        if amount > outstanding:
            order.status = "failed"
            order.failure_reason = f"Payment amount exceeds current-year outstanding balance ₹{outstanding}"
            db.commit()
            raise HTTPException(status_code=409, detail=order.failure_reason)
        remaining = amount
        allocations = []
        for item in payable_items:
            if remaining <= 0:
                break
            item_outstanding = _outstanding_for_student_fee(db, item)
            applied = min(item_outstanding, remaining)
            if applied > 0:
                allocations.append((item, applied))
                remaining = _money(remaining - applied)
    else:
        student_fee = db.query(StudentFee).filter_by(id=order.student_fee_id).first()
        if not student_fee:
            raise HTTPException(status_code=404, detail="Fee record not found")
        outstanding = _outstanding_for_student_fee(db, student_fee)
        if amount > outstanding:
            order.status = "failed"
            order.failure_reason = f"Payment amount exceeds outstanding balance ₹{outstanding}"
            db.commit()
            raise HTTPException(status_code=409, detail=order.failure_reason)
        allocations = [(student_fee, amount)]

    order.razorpay_payment_id = payment_id
    order.razorpay_signature = signature
    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)

    payments: list[FeePayment] = []
    for student_fee, applied_amount in allocations:
        payment = FeePayment(
            student_fee_id=student_fee.id,
            amount_paid=applied_amount,
            payment_date=date.today(),
            mode="online",
            receipt_number=generate_receipt_number(db),
            collected_by=None,
            notes=f"Razorpay payment {payment_id}",
            online_order_id=order.id,
        )
        db.add(payment)
        db.flush()
        payments.append(payment)
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


def verify_payment(db: Session, user: CurrentUser, order_id: str, payment_id: str, signature: str) -> list[FeePayment]:
    verify_checkout_signature(order_id, payment_id, signature)
    order = db.query(OnlinePaymentOrder).filter_by(razorpay_order_id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_student_access(db, user, _student_id_for_order(db, order))
    return mark_order_paid(db, order, payment_id, signature, actor_user_id=user.id)
