from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, field_validator, model_validator


class CreateOrderRequest(BaseModel):
    student_fee_id: Optional[int] = None
    student_id: Optional[int] = None
    amount: Decimal
    scope: Literal["single_fee", "current_year"] = "single_fee"
    payment_option: Optional[Literal["full", "half", "quarter"]] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value

    @model_validator(mode="after")
    def validate_target(self):
        if self.scope == "current_year":
            if not self.student_id:
                raise ValueError("student_id is required for current-year payments")
            if self.student_fee_id is not None:
                raise ValueError("student_fee_id is not used for current-year payments")
            return self
        if not self.student_fee_id:
            raise ValueError("student_fee_id is required for single-fee payments")
        return self


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
    student_fee_id: Optional[int] = None
    student_id: Optional[int] = None
    scope: str = "single_fee"
    payment_option: Optional[str] = None
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    amount: Decimal
    currency: str
    status: str
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    receipt_number: Optional[str] = None

    model_config = {"from_attributes": True}


class PaymentOrderStatusResponse(BaseModel):
    razorpay_order_id: str
    student_fee_id: Optional[int] = None
    student_id: Optional[int] = None
    scope: str = "single_fee"
    payment_option: Optional[str] = None
    status: str
    amount: Decimal
    currency: str
    receipt_number: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
