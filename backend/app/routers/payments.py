import json

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import FeePayment, OnlinePaymentOrder, StudentFee
from app.routers.auth import CurrentUser, ensure_student_access, require_role
from app.schemas.payments import (
    CreateOrderRequest,
    CreateOrderResponse,
    OnlinePaymentOrderOut,
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
    # Parse from cached raw body to avoid consuming the request stream twice.
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
