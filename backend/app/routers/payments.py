import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import FeePayment, OnlinePaymentOrder, StudentFee
from app.routers.auth import CurrentUser, ensure_student_access, require_role
from app.schemas.payments import (
    CreateOrderRequest,
    CreateOrderResponse,
    OnlinePaymentOrderOut,
    PaymentOrderStatusResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
from app.services import payment_service

router = APIRouter(prefix="/api/v1/payments", tags=["Online Payments"])
public_router = APIRouter(prefix="/api/v1/payments", tags=["Online Payments"])


@router.post("/create-order", response_model=CreateOrderResponse)
def create_order(
    body: CreateOrderRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "parent")),
):
    return payment_service.create_razorpay_order(db, user, body.student_fee_id, body.amount)


@router.post("/verify", response_model=VerifyPaymentResponse)
def verify_payment(
    body: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "parent")),
):
    payment = payment_service.verify_payment(
        db,
        user,
        body.razorpay_order_id,
        body.razorpay_payment_id,
        body.razorpay_signature,
    )
    return {"success": True, "receipt_number": payment.receipt_number}


@router.get("/order-status/{razorpay_order_id}", response_model=PaymentOrderStatusResponse)
def get_order_status(
    razorpay_order_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "parent", "student")),
):
    order = db.query(OnlinePaymentOrder).filter_by(razorpay_order_id=razorpay_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Payment order not found")
    student_fee = db.query(StudentFee).filter_by(id=order.student_fee_id).first()
    if not student_fee:
        raise HTTPException(status_code=404, detail="Fee record not found")
    ensure_student_access(db, user, student_fee.student_id)
    payment = db.query(FeePayment).filter_by(online_order_id=order.id).first()
    return {
        "razorpay_order_id": order.razorpay_order_id,
        "student_fee_id": order.student_fee_id,
        "status": order.status,
        "amount": order.amount,
        "currency": order.currency,
        "receipt_number": payment.receipt_number if payment else None,
        "failure_reason": order.failure_reason,
        "created_at": order.created_at,
        "paid_at": order.paid_at,
    }


@router.get("/history/{student_id}", response_model=list[OnlinePaymentOrderOut])
def get_payment_history(
    student_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "parent", "student")),
):
    ensure_student_access(db, user, student_id)
    orders = (
        db.query(OnlinePaymentOrder, FeePayment.receipt_number)
        .join(StudentFee, StudentFee.id == OnlinePaymentOrder.student_fee_id)
        .outerjoin(FeePayment, FeePayment.online_order_id == OnlinePaymentOrder.id)
        .filter(StudentFee.student_id == student_id)
        .order_by(OnlinePaymentOrder.created_at.desc(), OnlinePaymentOrder.id.desc())
        .all()
    )
    return [
        OnlinePaymentOrderOut.model_validate(order).model_copy(
            update={"receipt_number": receipt_number}
        )
        for order, receipt_number in orders
    ]


@public_router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    payment_service.verify_webhook_signature(
        body,
        request.headers.get("X-Razorpay-Signature"),
    )
    payload = json.loads(body)
    event = payload.get("event")
    if event == "payment.captured":
        entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = entity.get("order_id")
        if order_id:
            order = db.query(OnlinePaymentOrder).filter_by(razorpay_order_id=order_id).first()
            if order and order.status != "paid":
                payment_service.mark_order_paid_from_webhook(db, order, entity)
    return {"status": "ok"}
