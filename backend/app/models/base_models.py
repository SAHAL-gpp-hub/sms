"""
base_models.py  (updated)

New additions vs. previous version:
  - ExamSubjectConfig: per-exam override of max_theory / max_practical
    per subject. Allows "Unit Test 1 = 25 marks" while annual stays 100.
  - Subject.is_active: soft-disable subjects without deleting history.

All prior fixes (BUG-A duplicate academic_year_id, BUG-B StudentFee
academic_year_id, BUG-C aadhar_last4) are preserved unchanged.
"""

from sqlalchemy import (
    Column, Integer, String, Date, Boolean, ForeignKey,
    Numeric, DateTime, Text, Enum, UniqueConstraint, CheckConstraint,
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
    label      = Column(String(10), nullable=False, unique=True)
    start_date = Column(Date, nullable=False)
    end_date   = Column(Date, nullable=False)
    is_current = Column(Boolean, default=False)


class Class(Base):
    __tablename__ = "classes"

    id               = Column(Integer, primary_key=True)
    name             = Column(String(20), nullable=False)
    division         = Column(String(5),  nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))


# ──────────────────────────────────────────────────────────────
# Students
# ──────────────────────────────────────────────────────────────

class Student(Base):
    __tablename__ = "students"

    id               = Column(Integer, primary_key=True)
    student_id       = Column(String(20), unique=True, nullable=False)
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
    category         = Column(String(10), nullable=True)
    aadhar_last4     = Column(String(4),  nullable=True)
    admission_date   = Column(Date, nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    student_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    parent_user_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    status           = Column(Enum(StudentStatusEnum), default=StudentStatusEnum.Active)
    photo_path       = Column(String(255), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ──────────────────────────────────────────────────────────────
# Academic content
# ──────────────────────────────────────────────────────────────

class Subject(Base):
    __tablename__ = "subjects"

    id            = Column(Integer, primary_key=True)
    name          = Column(String(100), nullable=False)
    class_id      = Column(Integer, ForeignKey("classes.id"))
    max_theory    = Column(Integer, default=100)
    max_practical = Column(Integer, default=0)
    subject_type  = Column(String(20), default="Theory")
    # Soft-disable without losing mark history
    is_active     = Column(Boolean, default=True, nullable=False)

    # Relationships
    exam_configs  = relationship(
        "ExamSubjectConfig", back_populates="subject", cascade="all, delete-orphan"
    )


class Exam(Base):
    __tablename__ = "exams"

    id               = Column(Integer, primary_key=True)
    name             = Column(String(50), nullable=False)
    class_id         = Column(Integer, ForeignKey("classes.id"))
    exam_date        = Column(Date, nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))

    # Relationships
    subject_configs  = relationship(
        "ExamSubjectConfig", back_populates="exam", cascade="all, delete-orphan"
    )


class ExamSubjectConfig(Base):
    """
    Per-exam override for max_theory / max_practical per subject.

    When a row exists here for (exam_id, subject_id), marks_service uses
    these values instead of the subject-level defaults. This allows:
      - Unit Test 1 → 25 marks per subject
      - Half-Yearly → 50 marks per subject
      - Annual      → 100 marks (subject default, no override needed)

    Cascade deletes ensure configs are removed when their exam or subject
    is deleted.
    """
    __tablename__ = "exam_subject_configs"
    __table_args__ = (
        UniqueConstraint("exam_id", "subject_id", name="uq_exam_subject_config"),
    )

    id            = Column(Integer, primary_key=True)
    exam_id       = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    subject_id    = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    max_theory    = Column(Integer, nullable=False)
    max_practical = Column(Integer, nullable=False, default=0)

    # Relationships
    exam    = relationship("Exam",    back_populates="subject_configs")
    subject = relationship("Subject", back_populates="exam_configs")


class Mark(Base):
    __tablename__ = "marks"
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
    frequency   = Column(String(20),  nullable=False)
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
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=True)


class FeePayment(Base):
    __tablename__ = "fee_payments"

    id             = Column(Integer, primary_key=True)
    student_fee_id = Column(Integer, ForeignKey("student_fees.id"))
    amount_paid    = Column(Numeric(10, 2), nullable=False)
    payment_date   = Column(Date,           nullable=False)
    mode           = Column(String(20),     nullable=False)
    receipt_number = Column(String(30),     unique=True)
    collected_by   = Column(String(100),    nullable=True)


# ──────────────────────────────────────────────────────────────
# Attendance
# ──────────────────────────────────────────────────────────────

class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("student_id", "class_id", "date", name="uq_attendance_student_class_date"),
    )

    id         = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    class_id   = Column(Integer, ForeignKey("classes.id"))
    date       = Column(Date,    nullable=False)
    status     = Column(String(5), nullable=False)


# ──────────────────────────────────────────────────────────────
# Users (auth)
# ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'teacher', 'student', 'parent')",
            name="users_role_check",
        ),
    )

    id            = Column(Integer, primary_key=True)
    name          = Column(String(100), nullable=False)
    email         = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20),  default="admin")
    is_active     = Column(Boolean,     default=True)


class TeacherClassAssignment(Base):
    __tablename__ = "teacher_class_assignments"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id",
            "class_id",
            "academic_year_id",
            "subject_id",
            name="uq_teacher_class_year_subject",
        ),
    )

    id               = Column(Integer, primary_key=True)
    teacher_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    class_id         = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    subject_id       = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class TokenBlocklist(Base):
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
