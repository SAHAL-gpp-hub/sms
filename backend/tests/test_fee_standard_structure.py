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
)
from app.schemas.fee import FeeStructureCreate
from app.services import fee_service


def test_fee_structure_applies_to_all_sections_of_same_class(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'fees.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        year = AcademicYear(label="2025-26", start_date=date(2025, 6, 1), end_date=date(2026, 3, 31), is_current=True)
        db.add(year)
        db.flush()
        class_a = Class(name="5", division="A", academic_year_id=year.id)
        class_b = Class(name="5", division="B", academic_year_id=year.id)
        other = Class(name="6", division="A", academic_year_id=year.id)
        db.add_all([class_a, class_b, other])
        db.flush()

        students = [
            Student(
                student_id="SMS-5A",
                name_en="Section A Student",
                name_gu="A",
                dob=date(2015, 1, 1),
                gender=GenderEnum.M,
                class_id=class_a.id,
                father_name="Father A",
                contact="9000000001",
                admission_date=date(2025, 6, 1),
                academic_year_id=year.id,
                status=StudentStatusEnum.Active,
            ),
            Student(
                student_id="SMS-5B",
                name_en="Section B Student",
                name_gu="B",
                dob=date(2015, 1, 1),
                gender=GenderEnum.F,
                class_id=class_b.id,
                father_name="Father B",
                contact="9000000002",
                admission_date=date(2025, 6, 1),
                academic_year_id=year.id,
                status=StudentStatusEnum.Active,
            ),
        ]
        db.add_all(students)
        db.flush()
        db.add_all([
            Enrollment(student_id=students[0].id, class_id=class_a.id, academic_year_id=year.id, status=EnrollmentStatusEnum.active),
            Enrollment(student_id=students[1].id, class_id=class_b.id, academic_year_id=year.id, status=EnrollmentStatusEnum.active),
        ])
        head = FeeHead(name="Tuition Fee", frequency="Monthly", is_active=True)
        db.add(head)
        db.commit()

        fee_service.create_fee_structure_for_standard(
            db,
            FeeStructureCreate(
                class_id=class_a.id,
                fee_head_id=head.id,
                amount=Decimal("1200.00"),
                academic_year_id=year.id,
            ),
        )
        assigned = sum(
            fee_service.assign_fees_to_class(db, class_id, year.id)
            for class_id in fee_service.get_same_standard_class_ids(db, class_a.id, year.id)
        )

        structures = db.query(FeeStructure).filter_by(fee_head_id=head.id, academic_year_id=year.id).all()
        assert {fs.class_id for fs in structures} == {class_a.id, class_b.id}
        assert assigned == 2
        assert db.query(StudentFee).count() == 2
        assert db.query(FeeStructure).filter_by(class_id=other.id).count() == 0
    finally:
        db.close()
