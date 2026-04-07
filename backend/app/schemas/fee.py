from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal

class FeeHeadCreate(BaseModel):
    name: str
    frequency: str  # Monthly / Termly / One-Time / Annual
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
    student_id: int
    fee_structure_id: int
    concession: Decimal
    net_amount: Decimal
    fee_structure: Optional[FeeStructureOut] = None
    model_config = {"from_attributes": True}

class PaymentCreate(BaseModel):
    student_fee_id: int
    amount_paid: Decimal
    payment_date: date
    mode: str  # Cash / Cheque / DD / UPI
    collected_by: Optional[str] = None

class PaymentOut(BaseModel):
    id: int
    student_fee_id: int
    amount_paid: Decimal
    payment_date: date
    mode: str
    receipt_number: str
    collected_by: Optional[str]
    model_config = {"from_attributes": True}

class StudentLedgerItem(BaseModel):
    fee_head_name: str
    frequency: str
    net_amount: Decimal
    paid_amount: Decimal
    balance: Decimal
    student_fee_id: int

class StudentLedger(BaseModel):
    student_id: int
    student_name: str
    total_due: Decimal
    total_paid: Decimal
    total_balance: Decimal
    items: list[StudentLedgerItem]