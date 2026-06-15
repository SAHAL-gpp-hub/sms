from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.base_models import (
    AcademicYear,
    Class,
    Enrollment,
    EnrollmentStatusEnum,
    FeeHead,
    FeeStructure,
    GenderEnum,
    Student,
    StudentFee,
    StudentStatusEnum,
    FeePayment
)
from app.schemas.fee import PaymentCreate
from app.services import fee_service

def test_fee_instalments_and_receipts(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'fees.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        # Create year
        year = AcademicYear(label="2025-26", start_date=date(2025, 6, 1), end_date=date(2026, 3, 31), is_current=True)
        db.add(year)
        db.flush()
        
        # Create class
        cls = Class(name="5", division="A", academic_year_id=year.id)
        db.add(cls)
        db.flush()

        # Create student
        student = Student(
            student_id="SMS-101",
            name_en="Test Student",
            name_gu="Test",
            dob=date(2015, 1, 1),
            gender=GenderEnum.M,
            class_id=cls.id,
            father_name="Father",
            contact="9000000001",
            admission_date=date(2025, 6, 1),
            academic_year_id=year.id,
            status=StudentStatusEnum.Active,
        )
        db.add(student)
        db.flush()

        # Create enrollment
        enrollment = Enrollment(student_id=student.id, class_id=cls.id, academic_year_id=year.id, status=EnrollmentStatusEnum.active)
        db.add(enrollment)
        db.flush()

        # Create fee heads
        fh1 = FeeHead(name="Tuition Fee", frequency="Monthly", is_active=True)
        fh2 = FeeHead(name="Admission Fee", frequency="Yearly", is_active=True)
        db.add(fh1)
        db.add(fh2)
        db.flush()

        # Create fee structures
        fs1 = FeeStructure(class_id=cls.id, fee_head_id=fh1.id, amount=Decimal("1200.00"), academic_year_id=year.id)
        fs2 = FeeStructure(class_id=cls.id, fee_head_id=fh2.id, amount=Decimal("800.00"), academic_year_id=year.id)
        db.add(fs1)
        db.add(fs2)
        db.flush()

        # Create student fees
        sf1 = StudentFee(
            enrollment_id=enrollment.id,
            student_id=student.id,
            fee_structure_id=fs1.id,
            net_amount=Decimal("1200.00"),
            academic_year_id=year.id,
        )
        sf2 = StudentFee(
            enrollment_id=enrollment.id,
            student_id=student.id,
            fee_structure_id=fs2.id,
            net_amount=Decimal("800.00"),
            academic_year_id=year.id,
        )
        db.add(sf1)
        db.add(sf2)
        db.commit()

        # Verify payment options
        options = fee_service.get_payment_options(db, student.id)
        assert options["total_outstanding"] == Decimal("2000.00")
        assert options["options"][0]["amount"] == Decimal("2000.00")  # full
        assert options["options"][1]["amount"] == Decimal("1000.00")  # half
        assert options["options"][2]["amount"] == Decimal("500.00")   # quarter

        # Pay custom amount (500.00)
        p1 = fee_service.record_payment(db, PaymentCreate(
            student_id=student.id,
            amount_paid=Decimal("500.00"),
            mode="Cash",
            payment_date=date(2025, 6, 15)
        ))
        assert p1["total_amount"] == Decimal("500.00")
        assert p1["student_name"] == "Test Student"
        assert p1["total_balance_after"] == Decimal("1500.00")
        assert len(p1["allocations"]) == 1
        assert p1["allocations"][0]["fee_head_name"] == "Tuition Fee"
        assert p1["allocations"][0]["amount_applied"] == Decimal("500.00")
        assert p1["allocations"][0]["balance_after"] == Decimal("700.00")

        # Pay remaining tuition fee + partial admission fee (900.00)
        # 700 goes to Tuition Fee (balance becomes 0), 200 goes to Admission Fee (balance becomes 600)
        p2 = fee_service.record_payment(db, PaymentCreate(
            student_id=student.id,
            amount_paid=Decimal("900.00"),
            mode="UPI",
            payment_date=date(2025, 6, 20)
        ))
        assert p2["total_amount"] == Decimal("900.00")
        assert p2["total_balance_after"] == Decimal("600.00")
        assert len(p2["allocations"]) == 2
        
        # Verify monthly collections function
        collections = fee_service.get_monthly_collections(db, month=6, academic_year_id=year.id)
        assert len(collections) == 2
        days = {c["day"] for c in collections}
        assert "15 Jun" in days
        assert "20 Jun" in days
        
    finally:
        db.close()
