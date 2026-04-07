from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, Numeric, DateTime, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
from sqlalchemy.orm import relationship


class GenderEnum(str, enum.Enum):
    M = "M"
    F = "F"
    Other = "Other"

class StudentStatusEnum(str, enum.Enum):
    Active = "Active"
    TC_Issued = "TC Issued"
    Left = "Left"
    Passed_Out = "Passed Out"

class AcademicYear(Base):
    __tablename__ = "academic_years"
    id = Column(Integer, primary_key=True)
    label = Column(String(10), nullable=False, unique=True)  # e.g. "2025-26"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_current = Column(Boolean, default=False)

class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True)
    name = Column(String(20), nullable=False)  # Nursery/LKG/UKG/1..10
    division = Column(String(5), nullable=True)  # A/B/C
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True)
    student_id = Column(String(20), unique=True, nullable=False)  # SMS-2026-001
    gr_number = Column(String(20), nullable=True)
    name_en = Column(String(100), nullable=False)
    name_gu = Column(String(100), nullable=False)
    dob = Column(Date, nullable=False)
    gender = Column(Enum(GenderEnum), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"))
    roll_number = Column(Integer, nullable=True)
    father_name = Column(String(100), nullable=False)
    mother_name = Column(String(100), nullable=True)
    contact = Column(String(10), nullable=False)
    address = Column(Text, nullable=True)
    category = Column(String(10), nullable=True)  # GEN/OBC/SC/ST/EWS
    aadhar = Column(String(12), nullable=True)
    admission_date = Column(Date, nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))
    status = Column(Enum(StudentStatusEnum), default=StudentStatusEnum.Active)
    photo_path = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"))
    max_theory = Column(Integer, default=100)
    max_practical = Column(Integer, default=0)
    subject_type = Column(String(20), default="Theory")

class Exam(Base):
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)  # Unit Test 1 / Half-Yearly / Annual
    class_id = Column(Integer, ForeignKey("classes.id"))
    exam_date = Column(Date, nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))

class Mark(Base):
    __tablename__ = "marks"
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    exam_id = Column(Integer, ForeignKey("exams.id"))
    theory_marks = Column(Numeric(5, 2), nullable=True)
    practical_marks = Column(Numeric(5, 2), nullable=True)
    is_absent = Column(Boolean, default=False)

class FeeHead(Base):
    __tablename__ = "fee_heads"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    frequency = Column(String(20), nullable=False)  # Monthly/Termly/One-Time/Annual
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

class FeeStructure(Base):
    __tablename__ = "fee_structures"
    id = Column(Integer, primary_key=True)
    class_id = Column(Integer, ForeignKey("classes.id"))
    fee_head_id = Column(Integer, ForeignKey("fee_heads.id"))
    amount = Column(Numeric(10, 2), nullable=False)
    due_date = Column(Date, nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))

class StudentFee(Base):
    __tablename__ = "student_fees"
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    fee_structure_id = Column(Integer, ForeignKey("fee_structures.id"))
    concession = Column(Numeric(10, 2), default=0)
    net_amount = Column(Numeric(10, 2), nullable=False)

class FeePayment(Base):
    __tablename__ = "fee_payments"
    id = Column(Integer, primary_key=True)
    student_fee_id = Column(Integer, ForeignKey("student_fees.id"))
    amount_paid = Column(Numeric(10, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    mode = Column(String(20), nullable=False)  # Cash/Cheque/DD/UPI
    receipt_number = Column(String(30), unique=True)
    collected_by = Column(String(100), nullable=True)

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    class_id = Column(Integer, ForeignKey("classes.id"))
    date = Column(Date, nullable=False)
    status = Column(String(5), nullable=False)  # P/A/L/OL

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="admin")
    is_active = Column(Boolean, default=True)

FeeStructure.fee_head = relationship("FeeHead", foreign_keys=[FeeStructure.fee_head_id])
StudentFee.fee_structure = relationship("FeeStructure", foreign_keys=[StudentFee.fee_structure_id])
StudentFee.payments = relationship("FeePayment", foreign_keys=[FeePayment.student_fee_id])

