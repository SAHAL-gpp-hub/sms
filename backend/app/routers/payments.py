import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import OnlinePaymentOrder, StudentFee
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
    if body.scope == "current_year":
        return payment_service.create_current_year_order(
            db,
            user,
            body.student_id,
            body.amount,
            body.payment_option,
        )
    return payment_service.create_razorpay_order(db, user, body.student_fee_id, body.amount)


@router.post("/verify", response_model=VerifyPaymentResponse)
def verify_payment(
    body: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "parent")),
):
    payments = payment_service.verify_payment(
        db,
        user,
        body.razorpay_order_id,
        body.razorpay_payment_id,
        body.razorpay_signature,
    )
    return {"success": True, "receipt_number": payment_service._receipt_summary(payments)}


@router.get("/order-status/{razorpay_order_id}", response_model=PaymentOrderStatusResponse)
def get_order_status(
    razorpay_order_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "parent", "student")),
):
    order = db.query(OnlinePaymentOrder).filter_by(razorpay_order_id=razorpay_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Payment order not found")
    student_id = order.student_id
    if not student_id and order.student_fee_id:
        student_fee = db.query(StudentFee).filter_by(id=order.student_fee_id).first()
        if not student_fee:
            raise HTTPException(status_code=404, detail="Fee record not found")
        student_id = student_fee.student_id
    ensure_student_access(db, user, student_id)
    return {
        "razorpay_order_id": order.razorpay_order_id,
        "student_fee_id": order.student_fee_id,
        "student_id": student_id,
        "scope": order.scope,
        "payment_option": order.payment_option,
        "status": order.status,
        "amount": order.amount,
        "net_amount": order.net_amount,
        "platform_charge": order.platform_charge,
        "gross_amount": order.gross_amount,
        "currency": order.currency,
        "receipt_number": payment_service.get_order_receipt_summary(db, order.id),
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
        db.query(OnlinePaymentOrder)
        .outerjoin(StudentFee, StudentFee.id == OnlinePaymentOrder.student_fee_id)
        .filter((OnlinePaymentOrder.student_id == student_id) | (StudentFee.student_id == student_id))
        .order_by(OnlinePaymentOrder.created_at.desc(), OnlinePaymentOrder.id.desc())
        .all()
    )
    return [
        OnlinePaymentOrderOut.model_validate(order).model_copy(
            update={
                "student_id": order.student_id or (order.student_fee.student_id if order.student_fee else None),
                "receipt_number": payment_service.get_order_receipt_summary(db, order.id),
            }
        )
        for order in orders
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
