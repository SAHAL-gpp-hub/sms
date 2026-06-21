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

        # Verify payment options — month-based, 0 months paid → 12/6/3 offered.
        # total_original = 2000.00, per_month_rate = 2000/12 = 166.67
        options = fee_service.get_payment_options(db, student.id)
        assert options["summary"]["total_balance"] == Decimal("2000.00")
        assert options["summary"]["months_paid"] == 0
        assert options["summary"]["remaining_months"] == 12
        # Options returned largest-first: 12 (clears all), 6, 3
        assert [o["months"] for o in options["summary"]["options"]] == [12, 6, 3]
        assert options["summary"]["options"][0]["clears_all"] is True
        assert options["summary"]["options"][0]["amount"] == Decimal("2000.00")  # clears all = exact balance
        assert options["summary"]["options"][1]["amount"] == Decimal("1000.02")  # 6 * 166.67
        assert options["summary"]["options"][2]["amount"] == Decimal("500.01")   # 3 * 166.67

        # Pay 3 months (amount = 3 * 166.67 = 500.01), allocated proportionally.
        p1 = fee_service.record_payment(db, PaymentCreate(
            student_id=student.id,
            amount_paid=Decimal("500.01"),
            mode="Cash",
            payment_date=date(2025, 6, 15),
            months_to_cover=3,
        ))
        assert p1["total_amount"] == Decimal("500.01")
        assert p1["student_name"] == "Test Student"
        assert p1["total_balance_after"] == Decimal("1499.99")
        # Both fee heads receive a proportional share (1200/2000 and 800/2000 of 500.01).
        assert len(p1["allocations"]) == 2

        # After paying 3 months, options should offer 9 (clears all), 6, 3.
        options_after = fee_service.get_payment_options(db, student.id)
        assert options_after["summary"]["months_paid"] == 3
        assert options_after["summary"]["remaining_months"] == 9
        assert [o["months"] for o in options_after["summary"]["options"]] == [9, 6, 3]
        assert options_after["summary"]["options"][0]["clears_all"] is True
        assert options_after["summary"]["options"][0]["amount"] == Decimal("1499.99")  # exact balance

        # Verify monthly collections function
        collections = fee_service.get_monthly_collections(db, month=6, academic_year_id=year.id)
        assert len(collections) == 1
        assert collections[0]["day"] == "15 Jun"
        
    finally:
        db.close()
