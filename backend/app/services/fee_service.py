from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.models.base_models import (
    FeeHead, FeeStructure, StudentFee, FeePayment, Student, Class
)
from app.schemas.fee import (
    FeeHeadCreate, FeeStructureCreate, PaymentCreate,
    StudentLedger, StudentLedgerItem
)
from decimal import Decimal
from datetime import date

# ── Fee Heads ──────────────────────────────────────────────

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
    for fh in PRELOADED_FEE_HEADS:
        exists = db.query(FeeHead).filter_by(name=fh["name"]).first()
        if not exists:
            db.add(FeeHead(name=fh["name"], frequency=fh["frequency"], is_active=True))
    db.commit()

def get_fee_heads(db: Session):
    return db.query(FeeHead).filter_by(is_active=True).all()

def create_fee_head(db: Session, data: FeeHeadCreate):
    fh = FeeHead(**data.model_dump(), is_active=True)
    db.add(fh)
    db.commit()
    db.refresh(fh)
    return fh

# ── Fee Structure ──────────────────────────────────────────

def create_fee_structure(db: Session, data: FeeStructureCreate):
    fs = FeeStructure(**data.model_dump())
    db.add(fs)
    db.commit()
    db.refresh(fs)
    return fs

def get_fee_structures(db: Session, class_id: int = None, academic_year_id: int = None):
    q = db.query(FeeStructure).options(joinedload(FeeStructure.fee_head))
    if class_id:
        q = q.filter(FeeStructure.class_id == class_id)
    if academic_year_id:
        q = q.filter(FeeStructure.academic_year_id == academic_year_id)
    return q.all()

def delete_fee_structure(db: Session, fs_id: int):
    fs = db.query(FeeStructure).filter_by(id=fs_id).first()
    if fs:
        db.delete(fs)
        db.commit()
    return fs

# ── Student Fees ───────────────────────────────────────────

def assign_fees_to_class(db: Session, class_id: int, academic_year_id: int):
    structures = db.query(FeeStructure).filter_by(
        class_id=class_id, academic_year_id=academic_year_id
    ).all()
    students = db.query(Student).filter_by(
        class_id=class_id, academic_year_id=academic_year_id
    ).all()
    assigned = 0
    for student in students:
        for fs in structures:
            exists = db.query(StudentFee).filter_by(
                student_id=student.id, fee_structure_id=fs.id
            ).first()
            if not exists:
                db.add(StudentFee(
                    student_id=student.id,
                    fee_structure_id=fs.id,
                    concession=Decimal("0"),
                    net_amount=fs.amount
                ))
                assigned += 1
    db.commit()
    return assigned

def get_student_ledger(db: Session, student_id: int) -> StudentLedger:
    student = db.query(Student).filter_by(id=student_id).first()
    if not student:
        return None

    student_fees = db.query(StudentFee).options(
        joinedload(StudentFee.fee_structure).joinedload(FeeStructure.fee_head),
        joinedload(StudentFee.payments)
    ).filter_by(student_id=student_id).all()

    items = []
    total_due = Decimal("0")
    total_paid = Decimal("0")

    for sf in student_fees:
        paid = sum(p.amount_paid for p in sf.payments)
        balance = sf.net_amount - paid
        total_due += sf.net_amount
        total_paid += paid
        items.append(StudentLedgerItem(
            fee_head_name=sf.fee_structure.fee_head.name,
            frequency=sf.fee_structure.fee_head.frequency,
            net_amount=sf.net_amount,
            paid_amount=paid,
            balance=balance,
            student_fee_id=sf.id
        ))

    return StudentLedger(
        student_id=student_id,
        student_name=student.name_en,
        total_due=total_due,
        total_paid=total_paid,
        total_balance=total_due - total_paid,
        items=items
    )

# ── Payments ───────────────────────────────────────────────

def generate_receipt_number(db: Session) -> str:
    year = date.today().year
    count = db.query(FeePayment).count()
    return f"RCPT-{year}-{str(count + 1).zfill(5)}"

def record_payment(db: Session, data: PaymentCreate) -> FeePayment:
    receipt = generate_receipt_number(db)
    payment = FeePayment(
        **data.model_dump(),
        receipt_number=receipt
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

def get_payments_by_student(db: Session, student_id: int):
    student_fee_ids = [
        sf.id for sf in db.query(StudentFee).filter_by(student_id=student_id).all()
    ]
    return db.query(FeePayment).filter(
        FeePayment.student_fee_id.in_(student_fee_ids)
    ).order_by(FeePayment.payment_date.desc()).all()

# ── Defaulters ─────────────────────────────────────────────

def get_defaulters(db: Session, class_id: int = None, academic_year_id: int = None):
    q = db.query(Student).filter(Student.status == "Active")
    if class_id:
        q = q.filter(Student.class_id == class_id)
    if academic_year_id:
        q = q.filter(Student.academic_year_id == academic_year_id)

    defaulters = []
    for student in q.all():
        student_fees = db.query(StudentFee).options(
            joinedload(StudentFee.payments)
        ).filter_by(student_id=student.id).all()

        total_due = sum(sf.net_amount for sf in student_fees)
        total_paid = sum(
            sum(p.amount_paid for p in sf.payments)
            for sf in student_fees
        )
        balance = total_due - total_paid

        if balance > 0:
            cls = db.query(Class).filter_by(id=student.class_id).first()
            defaulters.append({
                "student_id": student.id,
                "student_name": student.name_en,
                "class_name": cls.name if cls else "—",
                "contact": student.contact,
                "total_due": float(total_due),
                "total_paid": float(total_paid),
                "balance": float(balance),
            })

    defaulters.sort(key=lambda x: x["balance"], reverse=True)
    return defaulters