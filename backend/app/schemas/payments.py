from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, field_validator, model_validator


class CreateOrderRequest(BaseModel):
    student_fee_id: Optional[int] = None
    student_id: Optional[int] = None
    amount: Decimal
    scope: Literal["single_fee", "current_year"] = "single_fee"
    # Month-based payment: number of months this payment covers (3/6/9/12).
    months_to_cover: Optional[int] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value

    @field_validator("months_to_cover")
    @classmethod
    def validate_months(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value not in (3, 6, 9, 12):
            raise ValueError("months_to_cover must be 3, 6, 9, or 12")
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
    net_amount: Decimal
    platform_charge: Decimal
    gross_amount: Decimal
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
    net_amount: Decimal
    platform_charge: Decimal
    gross_amount: Decimal
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
    net_amount: Decimal
    platform_charge: Decimal
    gross_amount: Decimal
    currency: str
    receipt_number: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
