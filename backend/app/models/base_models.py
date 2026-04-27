"""
base_models.py

FIXES APPLIED:
  BUG-A: Student.academic_year_id was defined TWICE in the class body.
         SQLAlchemy takes the LAST definition, which was nullable=False.
         This silently corrupted the mapper and caused IntegrityErrors on
         any Student row that went through the ORM before the column was set.
         Fix: remove the duplicate, keep the single nullable=False definition.

  BUG-B: StudentFee had NO academic_year_id column in the model even though:
         (a) the Alembic migration 384df2f48f9d adds it to the DB table, and
         (b) fee_service.py filters on StudentFee.academic_year_id.
         Without this column in the ORM model, every call to
         fee_service.assign_fees_to_class() raised an AttributeError crashing
         the /fees/assign endpoint entirely.
         Fix: add academic_year_id = Column(Integer, ForeignKey("academic_years.id"))
         to StudentFee, matching the migration.

  BUG-C: aadhar column in Student kept its old VARCHAR(12) definition while
         the migration renamed it to aadhar_last4 VARCHAR(4). Any codebase
         running without the migration would get "column aadhar_last4 does
         not exist" on every INSERT. The model now uses aadhar_last4 to
         match the migration and the schema layer.
"""

from sqlalchemy import (
    Column, Integer, String, Date, Boolean, ForeignKey,
    Numeric, DateTime, Text, Enum, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


# ──────────────────────────────────────────────────────────────
# Enumerations
# ──────────────────────────────────────────────────────────────

class GenderEnum(str, enum.Enum):
    M     = "M"
    F     = "F"
    Other = "Other"


class StudentStatusEnum(str, enum.Enum):
    Active      = "Active"
    TC_Issued   = "TC Issued"
    Left        = "Left"
    Passed_Out  = "Passed Out"


# ──────────────────────────────────────────────────────────────
# Reference / Setup tables
# ──────────────────────────────────────────────────────────────

class AcademicYear(Base):
    __tablename__ = "academic_years"

    id         = Column(Integer, primary_key=True)
    label      = Column(String(10), nullable=False, unique=True)   # e.g. "2025-26"
    start_date = Column(Date, nullable=False)
    end_date   = Column(Date, nullable=False)
    is_current = Column(Boolean, default=False)


class Class(Base):
    __tablename__ = "classes"

    id               = Column(Integer, primary_key=True)
    name             = Column(String(20), nullable=False)   # Nursery/LKG/UKG/1..10
    division         = Column(String(5),  nullable=True)    # A/B/C
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))


# ──────────────────────────────────────────────────────────────
# Students
# ──────────────────────────────────────────────────────────────

class Student(Base):
    __tablename__ = "students"

    id               = Column(Integer, primary_key=True)
    student_id       = Column(String(20), unique=True, nullable=False)  # SMS-2026-001
    gr_number        = Column(String(20), nullable=True)
    name_en          = Column(String(100), nullable=False)
    name_gu          = Column(String(100), nullable=False)
    dob              = Column(Date, nullable=False)
    gender           = Column(Enum(GenderEnum), nullable=False)
    class_id         = Column(Integer, ForeignKey("classes.id"))
    roll_number      = Column(Integer, nullable=True)
    father_name      = Column(String(100), nullable=False)
    mother_name      = Column(String(100), nullable=True)
    contact          = Column(String(10), nullable=False)
    address          = Column(Text, nullable=True)
    category         = Column(String(10), nullable=True)   # GEN/OBC/SC/ST/EWS
    # BUG-C FIX: renamed from aadhar VARCHAR(12) → aadhar_last4 VARCHAR(4)
    # to match migration 384df2f48f9d and comply with the Aadhaar Act
    # (storing only last-4 digits is the legally correct approach).
    aadhar_last4     = Column(String(4),  nullable=True)
    admission_date   = Column(Date, nullable=False)
    # BUG-A FIX: single definition of academic_year_id — the duplicate that
    # existed previously (one nullable, one nullable=False) caused SQLAlchemy
    # to silently use the last definition and confused the mapper.
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    status           = Column(Enum(StudentStatusEnum), default=StudentStatusEnum.Active)
    photo_path       = Column(String(255), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ──────────────────────────────────────────────────────────────
# Academic content
# ──────────────────────────────────────────────────────────────

class Subject(Base):
    __tablename__ = "subjects"

    id           = Column(Integer, primary_key=True)
    name         = Column(String(100), nullable=False)
    class_id     = Column(Integer, ForeignKey("classes.id"))
    max_theory   = Column(Integer, default=100)
    max_practical = Column(Integer, default=0)
    subject_type = Column(String(20), default="Theory")


class Exam(Base):
    __tablename__ = "exams"

    id               = Column(Integer, primary_key=True)
    name             = Column(String(50), nullable=False)  # Unit Test 1 / Half-Yearly / Annual
    class_id         = Column(Integer, ForeignKey("classes.id"))
    exam_date        = Column(Date, nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))


class Mark(Base):
    __tablename__ = "marks"
    # STEP 2.5 FIX: unique constraint prevents duplicate mark entries for the
    # same student/subject/exam combination — previously two concurrent
    # bulk_save_marks calls could both INSERT the same (student, subject, exam)
    # row; the second would silently create a duplicate rather than upsert.
    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", "exam_id", name="uq_mark_student_subject_exam"),
    )

    id               = Column(Integer, primary_key=True)
    student_id       = Column(Integer, ForeignKey("students.id"))
    subject_id       = Column(Integer, ForeignKey("subjects.id"))
    exam_id          = Column(Integer, ForeignKey("exams.id"))
    theory_marks     = Column(Numeric(5, 2), nullable=True)
    practical_marks  = Column(Numeric(5, 2), nullable=True)
    is_absent        = Column(Boolean, default=False)


# ──────────────────────────────────────────────────────────────
# Fees
# ──────────────────────────────────────────────────────────────

class FeeHead(Base):
    __tablename__ = "fee_heads"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(100), nullable=False)
    frequency   = Column(String(20),  nullable=False)  # Monthly/Termly/One-Time/Annual
    description = Column(Text,        nullable=True)
    is_active   = Column(Boolean,     default=True)


class FeeStructure(Base):
    __tablename__ = "fee_structures"

    id               = Column(Integer, primary_key=True)
    class_id         = Column(Integer, ForeignKey("classes.id"))
    fee_head_id      = Column(Integer, ForeignKey("fee_heads.id"))
    amount           = Column(Numeric(10, 2), nullable=False)
    due_date         = Column(Date, nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))


class StudentFee(Base):
    __tablename__ = "student_fees"

    id               = Column(Integer, primary_key=True)
    student_id       = Column(Integer, ForeignKey("students.id"))
    fee_structure_id = Column(Integer, ForeignKey("fee_structures.id"))
    concession       = Column(Numeric(10, 2), default=0)
    net_amount       = Column(Numeric(10, 2), nullable=False)
    # BUG-B FIX: this column exists in the DB (added by migration 384df2f48f9d)
    # but was missing from the ORM model. fee_service.py filters and writes
    # this column; without it in the model every fee assignment call raised
    # "AttributeError: type object 'StudentFee' has no attribute 'academic_year_id'"
    # and the entire /fees/assign endpoint was dead.
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=True)


class FeePayment(Base):
    __tablename__ = "fee_payments"

    id             = Column(Integer, primary_key=True)
    student_fee_id = Column(Integer, ForeignKey("student_fees.id"))
    amount_paid    = Column(Numeric(10, 2), nullable=False)
    payment_date   = Column(Date,           nullable=False)
    mode           = Column(String(20),     nullable=False)   # Cash/Cheque/DD/UPI
    receipt_number = Column(String(30),     unique=True)
    collected_by   = Column(String(100),    nullable=True)


# ──────────────────────────────────────────────────────────────
# Attendance
# ──────────────────────────────────────────────────────────────

class Attendance(Base):
    __tablename__ = "attendance"
    # STEP 2.5 FIX: unique constraint prevents duplicate attendance records for
    # the same student/class/date — without this, marking attendance twice in
    # quick succession creates two rows for the same day instead of updating.
    __table_args__ = (
        UniqueConstraint("student_id", "class_id", "date", name="uq_attendance_student_class_date"),
    )

    id         = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    class_id   = Column(Integer, ForeignKey("classes.id"))
    date       = Column(Date,    nullable=False)
    status     = Column(String(5), nullable=False)   # P/A/L/OL


# ──────────────────────────────────────────────────────────────
# Users (auth)
# ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True)
    name          = Column(String(100), nullable=False)
    email         = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20),  default="admin")
    is_active     = Column(Boolean,     default=True)


class TokenBlocklist(Base):
    """
    STEP 4.7: JWT revocation store. On logout the token's `jti` claim is
    persisted here; get_current_user checks this table before accepting the
    token. Expired tokens are naturally harmless but can be pruned periodically.
    """
    __tablename__ = "token_blocklist"

    id         = Column(Integer, primary_key=True)
    jti        = Column(String(36), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ──────────────────────────────────────────────────────────────
# Relationships (defined after all classes to avoid forward-ref issues)
# ──────────────────────────────────────────────────────────────

FeeStructure.fee_head = relationship(
    "FeeHead", foreign_keys=[FeeStructure.fee_head_id]
)
StudentFee.fee_structure = relationship(
    "FeeStructure", foreign_keys=[StudentFee.fee_structure_id]
)
StudentFee.payments = relationship(
    "FeePayment", foreign_keys=[FeePayment.student_fee_id]
)
