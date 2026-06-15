from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date
from decimal import Decimal

class FeeHeadCreate(BaseModel):
    name: str
    frequency: str
    description: Optional[str] = None

class FeeHeadOut(BaseModel):
    id: int
    name: str
    frequency: str
    description: Optional[str]
    is_active: bool
    model_config = {"from_attributes": True}

class FeeStructureCreate(BaseModel):
    class_id: int
    fee_head_id: int
    amount: Decimal
    due_date: Optional[date] = None
    academic_year_id: int

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Fee amount must be greater than 0")
        return v

class FeePlanItem(BaseModel):
    fee_head_id: int
    amount: Decimal
    due_date: Optional[date] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Fee amount must be greater than 0")
        return v

class FeePlanRequest(BaseModel):
    class_id: int
    academic_year_id: int
    items: list[FeePlanItem]

class FeePlanPreview(BaseModel):
    class_id: int
    academic_year_id: int
    affected_students: int
    item_count: int
    total_per_student: Decimal
    existing_items: int
    warnings: list[str] = []

class FeePlanApplyResult(FeePlanPreview):
    assigned: int

class FeeStructureOut(BaseModel):
    id: int
    class_id: int
    fee_head_id: int
    amount: Decimal
    due_date: Optional[date]
    academic_year_id: int
    fee_head: Optional[FeeHeadOut] = None
    model_config = {"from_attributes": True}

class StudentFeeOut(BaseModel):
    id: int
    enrollment_id: int
    student_id: Optional[int] = None
    fee_structure_id: int
    concession: Decimal
    net_amount: Decimal
    fee_structure: Optional[FeeStructureOut] = None
    model_config = {"from_attributes": True}

class PaymentCreate(BaseModel):
    student_id: int
    amount_paid: Decimal
    payment_date: date
    mode: str
    collected_by: Optional[str] = None
    notes: Optional[str] = None
    academic_year_id: Optional[int] = None

    @field_validator("amount_paid")
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Payment amount must be greater than 0")
        return v

class PaymentAllocation(BaseModel):
    fee_head_name: str
    amount_applied: Decimal
    balance_after: Decimal

class PaymentOut(BaseModel):
    id: int
    receipt_numbers: list[str]
    total_amount: Decimal
    payment_date: date
    mode: str
    collected_by: Optional[str] = None
    student_name: Optional[str] = None
    student_gr_no: Optional[str] = None
    class_name: Optional[str] = None
    allocations: list[PaymentAllocation] = []
    total_balance_after: Decimal
    
    model_config = {"from_attributes": True}

class StudentLedgerItem(BaseModel):
    fee_head_name: str
    frequency: str
    net_amount: Decimal
    paid_amount: Decimal
    balance: Decimal
    student_fee_id: int
    enrollment_id: int
    academic_year_id: Optional[int] = None
    invoice_type: str = "regular"


class StudentLedger(BaseModel):
    student_id: int
    student_name: str
    total_due: Decimal
    total_paid: Decimal
    total_balance: Decimal
    items: list[StudentLedgerItem]
