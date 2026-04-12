"""
base_models.py — SQLAlchemy ORM models for School Management System

FIXES APPLIED:
  - Issue 3:  All relationship() calls moved inside class bodies (were at module level).
  - Bug 2:    StudentFee gains academic_year_id column so fee history survives promotion
              without relying on student.academic_year_id join through FeeStructure.
  - Security: Aadhar stored as last-4-digits only (field renamed aadhar_last4).
              If you need to store full Aadhar, encrypt it at the application layer
              using a library such as cryptography.fernet BEFORE this model layer.
"""

import enum

from sqlalchemy import (
    Column, Integer, String, Date, Boolean,
    ForeignKey, Numeric, DateTime, Text, Enum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class GenderEnum(str, enum.Enum):
    M = "M"
    F = "F"
    Other = "Other"


class StudentStatusEnum(str, enum.Enum):
    Active = "Active"
    TC_Issued = "TC Issued"
    Left = "Left"
    Passed_Out = "Passed Out"


# ---------------------------------------------------------------------------
# Setup models
# ---------------------------------------------------------------------------

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
    division         = Column(String(5), nullable=True)     # A/B/C
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))

    # Relationships
    students = relationship("Student", back_populates="class_")
    subjects = relationship("Subject", back_populates="class_")
    exams    = relationship("Exam",    back_populates="class_")


# ---------------------------------------------------------------------------
# Student
# ---------------------------------------------------------------------------

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
    # SECURITY FIX: store only the last 4 digits of Aadhar.
    # Full Aadhar must NOT be stored in plaintext (Aadhaar Act 2016 compliance).
    aadhar_last4     = Column(String(4), nullable=True)
    admission_date   = Column(Date, nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))
    status           = Column(Enum(StudentStatusEnum), default=StudentStatusEnum.Active)
    photo_path       = Column(String(255), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships (ISSUE 3 FIX: inside class, not at module level)
    class_       = relationship("Class",   back_populates="students", foreign_keys=[class_id])
    marks        = relationship("Mark",       back_populates="student")
    student_fees = relationship("StudentFee", back_populates="student")
    attendance   = relationship("Attendance", back_populates="student")


# ---------------------------------------------------------------------------
# Academic content
# ---------------------------------------------------------------------------

class Subject(Base):
    __tablename__ = "subjects"

    id           = Column(Integer, primary_key=True)
    name         = Column(String(100), nullable=False)
    class_id     = Column(Integer, ForeignKey("classes.id"))
    max_theory   = Column(Integer, default=100)
    max_practical = Column(Integer, default=0)
    subject_type = Column(String(20), default="Theory")

    # Relationships
    class_  = relationship("Class",  back_populates="subjects")
    marks   = relationship("Mark",   back_populates="subject")


class Exam(Base):
    __tablename__ = "exams"

    id               = Column(Integer, primary_key=True)
    name             = Column(String(50), nullable=False)   # Unit Test 1 / Half-Yearly / Annual
    class_id         = Column(Integer, ForeignKey("classes.id"))
    exam_date        = Column(Date, nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))

    # Relationships
    class_ = relationship("Class", back_populates="exams")
    marks  = relationship("Mark",  back_populates="exam")


class Mark(Base):
    __tablename__ = "marks"

    id              = Column(Integer, primary_key=True)
    student_id      = Column(Integer, ForeignKey("students.id"))
    subject_id      = Column(Integer, ForeignKey("subjects.id"))
    exam_id         = Column(Integer, ForeignKey("exams.id"))
    theory_marks    = Column(Numeric(5, 2), nullable=True)
    practical_marks = Column(Numeric(5, 2), nullable=True)
    is_absent       = Column(Boolean, default=False)

    # Relationships
    student = relationship("Student", back_populates="marks")
    subject = relationship("Subject", back_populates="marks")
    exam    = relationship("Exam",    back_populates="marks")


# ---------------------------------------------------------------------------
# Fees
# ---------------------------------------------------------------------------

class FeeHead(Base):
    __tablename__ = "fee_heads"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(100), nullable=False)
    frequency   = Column(String(20), nullable=False)   # Monthly/Termly/One-Time/Annual
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True)

    # Relationships
    fee_structures = relationship("FeeStructure", back_populates="fee_head")


class FeeStructure(Base):
    __tablename__ = "fee_structures"

    id               = Column(Integer, primary_key=True)
    class_id         = Column(Integer, ForeignKey("classes.id"))
    fee_head_id      = Column(Integer, ForeignKey("fee_heads.id"))
    amount           = Column(Numeric(10, 2), nullable=False)
    due_date         = Column(Date, nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))

    # Relationships (ISSUE 3 FIX: inside class body)
    fee_head     = relationship("FeeHead",    back_populates="fee_structures", foreign_keys=[fee_head_id])
    student_fees = relationship("StudentFee", back_populates="fee_structure")


class StudentFee(Base):
    __tablename__ = "student_fees"

    id                = Column(Integer, primary_key=True)
    student_id        = Column(Integer, ForeignKey("students.id"))
    fee_structure_id  = Column(Integer, ForeignKey("fee_structures.id"))
    concession        = Column(Numeric(10, 2), default=0)
    net_amount        = Column(Numeric(10, 2), nullable=False)
    # BUG 2 FIX: explicit academic_year_id so fee history is never lost when
    # student.academic_year_id changes on promotion.
    academic_year_id  = Column(Integer, ForeignKey("academic_years.id"), nullable=True)

    # Relationships (ISSUE 3 FIX: inside class body)
    student       = relationship("Student",      back_populates="student_fees", foreign_keys=[student_id])
    fee_structure = relationship("FeeStructure", back_populates="student_fees", foreign_keys=[fee_structure_id])
    payments      = relationship("FeePayment",   back_populates="student_fee")


class FeePayment(Base):
    __tablename__ = "fee_payments"

    id              = Column(Integer, primary_key=True)
    student_fee_id  = Column(Integer, ForeignKey("student_fees.id"))
    amount_paid     = Column(Numeric(10, 2), nullable=False)
    payment_date    = Column(Date, nullable=False)
    mode            = Column(String(20), nullable=False)   # Cash/Cheque/DD/UPI
    receipt_number  = Column(String(30), unique=True)
    collected_by    = Column(String(100), nullable=True)

    # Relationships (ISSUE 3 FIX: inside class body)
    student_fee = relationship("StudentFee", back_populates="payments", foreign_keys=[student_fee_id])


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

class Attendance(Base):
    __tablename__ = "attendance"

    id         = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    class_id   = Column(Integer, ForeignKey("classes.id"))
    date       = Column(Date, nullable=False)
    status     = Column(String(5), nullable=False)   # P/A/L/OL

    # Relationships
    student = relationship("Student", back_populates="attendance")


# ---------------------------------------------------------------------------
# Users (auth)
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True)
    name          = Column(String(100), nullable=False)
    email         = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20), default="admin")
    is_active     = Column(Boolean, default=True)
