from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


class CreateOrderRequest(BaseModel):
    student_fee_id: int
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    student_name: str
    contact: Optional[str] = None
    email: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class VerifyPaymentResponse(BaseModel):
    success: bool
    receipt_number: str


class OnlinePaymentOrderOut(BaseModel):
    id: int
    student_fee_id: int
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    amount: Decimal
    currency: str
    status: str
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    receipt_number: Optional[str] = None

    model_config = {"from_attributes": True}
