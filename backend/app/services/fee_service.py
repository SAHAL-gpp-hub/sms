from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.base_models import Class, FeeHead, FeePayment, FeeStructure, Student, StudentFee
from app.schemas.fee import FeeHeadCreate, FeeStructureCreate, PaymentCreate, StudentLedger, StudentLedgerItem

PRELOADED_FEE_HEADS = [
    {"name": "Tuition Fee", "frequency": "Monthly"},
    {"name": "Admission Fee", "frequency": "One-Time"},
    {"name": "Exam Fee", "frequency": "Termly"},
    {"name": "Prospectus Fee", "frequency": "One-Time"},
    {"name": "Sports Fee", "frequency": "Annual"},
    {"name": "Computer Lab Fee", "frequency": "Annual"},
    {"name": "Library Fee", "frequency": "Annual"},
    {"name": "Late Payment Fine", "frequency": "One-Time"},
    {"name": "Development Fee", "frequency": "Annual"},
    {"name": "School Bus Fee", "frequency": "Monthly"},
]


def seed_fee_heads(db: Session):
    for fee_head in PRELOADED_FEE_HEADS:
        exists = db.query(FeeHead).filter_by(name=fee_head["name"]).first()
        if not exists:
            db.add(FeeHead(name=fee_head["name"], frequency=fee_head["frequency"], is_active=True))
    db.commit()


def get_fee_heads(db: Session):
    return db.query(FeeHead).filter_by(is_active=True).all()


def create_fee_head(db: Session, data: FeeHeadCreate):
    fee_head = FeeHead(**data.model_dump(), is_active=True)
    db.add(fee_head)
    db.commit()
    db.refresh(fee_head)
    return fee_head


def create_fee_structure(db: Session, data: FeeStructureCreate):
    if Decimal(str(data.amount)) <= 0:
        raise ValueError("Fee amount must be greater than 0")

    # Return existing if same class+fee_head+year (idempotent)
    existing = db.query(FeeStructure).filter_by(
        class_id=data.class_id,
        fee_head_id=data.fee_head_id,
        academic_year_id=data.academic_year_id
    ).first()
    if existing:
        existing.amount = data.amount  # update amount to latest
        db.commit()
        db.refresh(existing)
        return existing

    fee_structure = FeeStructure(**data.model_dump())
    db.add(fee_structure)
    db.commit()
    db.refresh(fee_structure)
    return fee_structure


def get_fee_structures(db: Session, class_id: Optional[int] = None, academic_year_id: Optional[int] = None):
    query = db.query(FeeStructure).options(joinedload(FeeStructure.fee_head))
    if class_id is not None:
        query = query.filter(FeeStructure.class_id == class_id)
    if academic_year_id is not None:
        query = query.filter(FeeStructure.academic_year_id == academic_year_id)
    return query.all()


def get_fee_structure(db: Session, fs_id: int):
    return (
        db.query(FeeStructure)
        .options(joinedload(FeeStructure.fee_head))
        .filter(FeeStructure.id == fs_id)
        .first()
    )


def delete_fee_structure(db: Session, fs_id: int):
    fee_structure = db.query(FeeStructure).filter_by(id=fs_id).first()
    if fee_structure:
        db.delete(fee_structure)
        db.commit()
    return fee_structure


def assign_fees_to_class(db: Session, class_id: int, academic_year_id: Optional[int] = None):
    if academic_year_id is None:
        student_year = (
            db.query(Student.academic_year_id)
            .filter(Student.class_id == class_id, Student.status == "Active")
            .first()
        )
        structure_year = (
            db.query(FeeStructure.academic_year_id)
            .filter(FeeStructure.class_id == class_id)
            .first()
        )
        academic_year_id = (
            (student_year[0] if student_year else None)
            or (structure_year[0] if structure_year else None)
            or 1
        )

    structures = (
        db.query(FeeStructure)
        .filter_by(class_id=class_id, academic_year_id=academic_year_id)
        .all()
    )
    students = (
        db.query(Student)
        .filter_by(class_id=class_id, academic_year_id=academic_year_id)
        .filter(Student.status == "Active")
        .all()
    )

    assigned = 0
    for student in students:
        for fee_structure in structures:
            exists = db.query(StudentFee).filter_by(
                student_id=student.id,
                fee_structure_id=fee_structure.id,
            ).first()
            if not exists:
                db.add(
                    StudentFee(
                        student_id=student.id,
                        fee_structure_id=fee_structure.id,
                        concession=Decimal("0.00"),
                        net_amount=Decimal(str(fee_structure.amount)),
                    )
                )
                assigned += 1

    db.commit()
    return assigned


def get_student_ledger(db: Session, student_id: int) -> Optional[StudentLedger]:
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        return None

    student_fees = (
    db.query(StudentFee)
    .join(FeeStructure, StudentFee.fee_structure_id == FeeStructure.id)
    .options(
        joinedload(StudentFee.fee_structure).joinedload(FeeStructure.fee_head),
        joinedload(StudentFee.payments),
    )
    .filter(
        StudentFee.student_id == student_id,
        FeeStructure.academic_year_id == student.academic_year_id
    )
    .all()
)

    items = []
    total_due = Decimal("0.00")
    total_paid = Decimal("0.00")

    for student_fee in student_fees:
        paid = sum((Decimal(str(payment.amount_paid)) for payment in student_fee.payments), Decimal("0.00"))
        net_amount = Decimal(str(student_fee.net_amount))
        balance = net_amount - paid
        total_due += net_amount
        total_paid += paid
        items.append(
            StudentLedgerItem(
                fee_head_name=student_fee.fee_structure.fee_head.name,
                frequency=student_fee.fee_structure.fee_head.frequency,
                net_amount=net_amount,
                paid_amount=paid,
                balance=balance,
                student_fee_id=student_fee.id,
            )
        )

    return StudentLedger(
        student_id=student_id,
        student_name=student.name_en,
        total_due=total_due,
        total_paid=total_paid,
        total_balance=total_due - total_paid,
        items=items,
    )


def generate_receipt_number(db: Session) -> str:
    year = date.today().year
    count = db.query(FeePayment).count()
    return f"RCPT-{year}-{str(count + 1).zfill(5)}"


def record_payment(db: Session, data: PaymentCreate) -> FeePayment:
    if Decimal(str(data.amount_paid)) <= 0:
        raise ValueError("Payment amount must be greater than 0")

    student_fee = db.query(StudentFee).filter_by(id=data.student_fee_id).first()
    if not student_fee:
        raise LookupError("Student fee not found")

    receipt = generate_receipt_number(db)
    payment = FeePayment(**data.model_dump(), receipt_number=receipt)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def get_payments_by_student(db: Session, student_id: int):
    student_fee_ids = [student_fee.id for student_fee in db.query(StudentFee).filter_by(student_id=student_id).all()]
    if not student_fee_ids:
        return []
    return (
        db.query(FeePayment)
        .filter(FeePayment.student_fee_id.in_(student_fee_ids))
        .order_by(FeePayment.payment_date.desc(), FeePayment.id.desc())
        .all()
    )


def get_defaulters(db: Session, class_id: Optional[int] = None, academic_year_id: Optional[int] = None):
    query = db.query(Student).filter(Student.status == "Active")
    if class_id is not None:
        query = query.filter(Student.class_id == class_id)
    if academic_year_id is not None:
        query = query.filter(Student.academic_year_id == academic_year_id)

    defaulters = []
    for student in query.all():
        student_fees = (
    db.query(StudentFee)
    .join(FeeStructure, StudentFee.fee_structure_id == FeeStructure.id)
    .options(joinedload(StudentFee.payments))
    .filter(
        StudentFee.student_id == student.id,
        FeeStructure.academic_year_id == student.academic_year_id
    )
    .all()
)

        total_due = sum((Decimal(str(student_fee.net_amount)) for student_fee in student_fees), Decimal("0.00"))
        total_paid = sum(
            (
                sum((Decimal(str(payment.amount_paid)) for payment in student_fee.payments), Decimal("0.00"))
                for student_fee in student_fees
            ),
            Decimal("0.00"),
        )
        balance = total_due - total_paid

        if balance > 0:
            class_row = db.query(Class).filter_by(id=student.class_id).first()
            defaulters.append(
                {
                    "student_id": student.id,
                    "student_name": student.name_en,
                    "class_id": student.class_id,
                    "class_name": class_row.name if class_row else "—",
                    "contact": student.contact,
                    "total_due": float(total_due),
                    "total_paid": float(total_paid),
                    "balance": float(balance),
                }
            )

    defaulters.sort(key=lambda item: item["balance"], reverse=True)
    return defaulters
