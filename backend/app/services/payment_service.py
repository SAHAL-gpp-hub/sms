import hashlib
import hmac
import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.base_models import FeePayment, OnlinePaymentOrder, StudentFee
from app.routers.auth import CurrentUser, ensure_student_access
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
) -> FeePayment:
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

    try:
        import razorpay
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Razorpay SDK is not installed") from exc

    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    order = client.order.create({
        "amount": _to_paise(amount),
        "currency": "INR",
        "receipt": f"sf_{student_fee_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "notes": {
            "student_fee_id": str(student_fee_id),
            "student_id": str(student_fee.student_id),
            "student_name": student_fee.student.name_en if student_fee.student else "",
        },
    })

    db_order = OnlinePaymentOrder(
        student_fee_id=student_fee_id,
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


def mark_order_paid(
    db: Session,
    order: OnlinePaymentOrder,
    payment_id: str,
    signature: str | None = None,
    actor_user_id: int | None = None,
) -> FeePayment:
    existing_payment = db.query(FeePayment).filter_by(online_order_id=order.id).first()
    if existing_payment:
        if order.status != "paid":
            order.razorpay_payment_id = payment_id
            order.razorpay_signature = signature
            order.status = "paid"
            order.paid_at = datetime.now(timezone.utc)
            db.commit()
        return existing_payment

    if order.status == "paid":
        raise HTTPException(status_code=409, detail="Order is paid but receipt is missing")

    student_fee = db.query(StudentFee).filter_by(id=order.student_fee_id).first()
    if not student_fee:
        raise HTTPException(status_code=404, detail="Fee record not found")

    outstanding = _outstanding_for_student_fee(db, student_fee)
    amount = _money(order.amount)
    if amount > outstanding:
        order.status = "failed"
        order.failure_reason = f"Payment amount exceeds outstanding balance ₹{outstanding}"
        db.commit()
        raise HTTPException(status_code=409, detail=order.failure_reason)

    receipt_number = generate_receipt_number(db)

    order.razorpay_payment_id = payment_id
    order.razorpay_signature = signature
    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)

    payment = FeePayment(
        student_fee_id=order.student_fee_id,
        amount_paid=amount,
        payment_date=date.today(),
        mode="online",
        receipt_number=receipt_number,
        collected_by=None,
        notes=f"Razorpay payment {payment_id}",
        online_order_id=order.id,
    )
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


def verify_payment(db: Session, user: CurrentUser, order_id: str, payment_id: str, signature: str) -> FeePayment:
    verify_checkout_signature(order_id, payment_id, signature)
    order = db.query(OnlinePaymentOrder).filter_by(razorpay_order_id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _get_accessible_student_fee(db, user, order.student_fee_id)
    return mark_order_paid(db, order, payment_id, signature, actor_user_id=user.id)
