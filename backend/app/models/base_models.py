"""
base_models.py — Complete rewrite incorporating all planning-doc requirements.

New models vs previous version:
  - Enrollment         : central year-scoped node (THE critical missing piece)
  - AcademicCalendar   : term / holiday / event calendar per year
  - ReportCard         : stored PDF path + is_locked flag
  - AuditLog           : every bulk operation logged with before/after state

Updated models:
  - AcademicYear       : added status (draft/active/closed), is_upcoming
  - Class              : added capacity, medium, promotion_status
  - Subject            : added code, is_exam_eligible, passing_marks
  - Exam               : added weightage
  - Student            : added reason_for_leaving, previous_school; extended status enum
  - Mark               : added locked_at
  - StudentFee         : added invoice_type, source_invoice_id (for arrears)
"""

import enum
from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime, Enum,
    ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


# ─────────────────────────────────────────────────────────────────────────────
# Enumerations
# ─────────────────────────────────────────────────────────────────────────────

class GenderEnum(str, enum.Enum):
    M     = "M"
    F     = "F"
    Other = "Other"


class StudentStatusEnum(str, enum.Enum):
    Active      = "Active"
    TC_Issued   = "TC_Issued"
    Left        = "Left"
    Passed_Out  = "Passed_Out"
    Alumni      = "Alumni"       # NEW: Std 10/12 graduate, permanent record
    On_Hold     = "On_Hold"      # NEW: decision pending (compartment etc.)
    Detained    = "Detained"     # NEW: failed, will repeat same standard
    Provisional = "Provisional"  # NEW: compartment student, pending result


class YearStatusEnum(str, enum.Enum):
    draft  = "draft"   # being configured, no live ops
    active = "active"  # current operational year
    closed = "closed"  # ended, all data read-only


class EnrollmentStatusEnum(str, enum.Enum):
    active      = "active"
    retained    = "retained"     # failed/detained, same standard next year
    graduated   = "graduated"    # completed Std 10/12
    transferred = "transferred"  # TC issued
    dropped     = "dropped"      # dropped out
    provisional = "provisional"  # compartment, result pending
    on_hold     = "on_hold"      # decision pending


class CalendarEventTypeEnum(str, enum.Enum):
    holiday      = "holiday"
    exam_period  = "exam_period"
    term_start   = "term_start"
    term_end     = "term_end"
    event        = "event"


class AuditOperationEnum(str, enum.Enum):
    bulk_promote   = "bulk_promote"
    undo_promote   = "undo_promote"
    new_year       = "new_year"
    activate_year  = "activate_year"
    close_year     = "close_year"
    lock_marks     = "lock_marks"
    issue_tc       = "issue_tc"
    clone_subjects = "clone_subjects"
    clone_fees     = "clone_fees"
    student_activation_started = "student_activation_started"
    student_activation_verified = "student_activation_verified"
    student_activation_completed = "student_activation_completed"
    student_activation_failed = "student_activation_failed"


class ImportStatusEnum(str, enum.Enum):
    completed = "completed"
    rolled_back = "rolled_back"


# ─────────────────────────────────────────────────────────────────────────────
# Reference / Setup Tables
# ─────────────────────────────────────────────────────────────────────────────

class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(Text, nullable=True)
    gseb_affiliation_no = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id          = Column(Integer, primary_key=True)
    label       = Column(String(10), nullable=False, unique=True)
    start_date  = Column(Date, nullable=False)
    end_date    = Column(Date, nullable=False)
    is_current  = Column(Boolean, default=False)          # legacy compat
    is_upcoming = Column(Boolean, default=False)          # NEW
    status      = Column(                                 # NEW
        Enum(YearStatusEnum),
        nullable=False,
        default=YearStatusEnum.draft,
    )
    branch_id   = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)

    # Relationships
    enrollments = relationship("Enrollment", back_populates="academic_year")
    calendar    = relationship("AcademicCalendar", back_populates="academic_year",
                               cascade="all, delete-orphan")


class Class(Base):
    __tablename__ = "classes"

    id               = Column(Integer, primary_key=True)
    name             = Column(String(20), nullable=False)
    division         = Column(String(5), nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"))
    capacity         = Column(Integer, nullable=True)           # NEW max students
    medium           = Column(String(20), default="English")    # NEW English/Gujarati/Both
    promotion_status = Column(                                  # NEW idempotency lock
        String(20),
        nullable=False,
        default="not_started",
    )
    branch_id        = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    # promotion_status values: not_started / in_progress / completed


class AcademicCalendar(Base):   # NEW
    __tablename__ = "academic_calendar"

    id               = Column(Integer, primary_key=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    event_type       = Column(Enum(CalendarEventTypeEnum), nullable=False)
    title            = Column(String(200), nullable=False)
    start_date       = Column(Date, nullable=False)
    end_date         = Column(Date, nullable=False)
    description      = Column(Text, nullable=True)
    affects_attendance = Column(Boolean, nullable=False, default=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    academic_year = relationship("AcademicYear", back_populates="calendar")


# ─────────────────────────────────────────────────────────────────────────────
# Enrollment  (THE central year-scoped node)
# ─────────────────────────────────────────────────────────────────────────────

class Enrollment(Base):
    """
    One row per student per academic year.

    This is the architectural fix for the entire year-end system. Previously,
    attendance, marks, and fees all FK'd to student_id — a permanent identity
    that changes meaning each year. Now they should FK to enrollment_id, which
    is fully year-scoped.

    Migration back-fills enrollments from existing student rows, so existing
    data is preserved. New promotions create new Enrollment rows instead of
    mutating the Student row.
    """
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "academic_year_id", name="uq_enrollment_student_year"),
    )

    id               = Column(Integer, primary_key=True)
    student_id       = Column(Integer, ForeignKey("students.id", ondelete="RESTRICT"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False, index=True)
    class_id         = Column(Integer, ForeignKey("classes.id"), nullable=False, index=True)
    roll_number      = Column(String(30), nullable=True)   # string: supports "2025-07-A-01"
    original_roll_number = Column(String(30), nullable=True)
    status           = Column(
        Enum(EnrollmentStatusEnum),
        nullable=False,
        default=EnrollmentStatusEnum.active,
    )
    promotion_action = Column(String(20), nullable=True)   # promoted/retained/graduated/etc.
    promotion_status = Column(String(20), nullable=False, default="not_started")
                                                           # not_started / completed (idempotency)
    enrolled_on      = Column(Date, nullable=False, default=func.current_date())
    reason_for_leaving = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    student      = relationship("Student", back_populates="enrollments")
    academic_year = relationship("AcademicYear", back_populates="enrollments")
    report_cards = relationship("ReportCard", back_populates="enrollment",
                                cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
# Students
# ─────────────────────────────────────────────────────────────────────────────

class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("student_user_id", name="uq_students_student_user_id"),
    )

    id               = Column(Integer, primary_key=True)
    student_id       = Column(String(20), unique=True, nullable=False)
    gr_number        = Column(String(20), nullable=True, index=True)   # index added
    name_en          = Column(String(100), nullable=False)
    name_gu          = Column(String(100), nullable=False)
    dob              = Column(Date, nullable=False)
    gender           = Column(Enum(GenderEnum), nullable=False)
    class_id         = Column(Integer, ForeignKey("classes.id"), index=True)
    roll_number      = Column(Integer, nullable=True)   # legacy; use enrollment.roll_number
    father_name      = Column(String(100), nullable=False)
    mother_name      = Column(String(100), nullable=True)
    contact          = Column(String(10), nullable=False)
    student_email    = Column(String(100), unique=True, nullable=True)
    student_phone    = Column(String(20), nullable=True)
    guardian_email   = Column(String(100), nullable=True, index=True)
    guardian_phone   = Column(String(20), nullable=True)
    address          = Column(Text, nullable=True)
    category         = Column(String(10), nullable=True)
    aadhar_last4     = Column(String(4), nullable=True)
    admission_date   = Column(Date, nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False, index=True)
    branch_id        = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    student_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    parent_user_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    status           = Column(
        Enum(StudentStatusEnum),
        default=StudentStatusEnum.Active,
        index=True,
    )
    photo_path          = Column(String(255), nullable=True)
    reason_for_leaving  = Column(Text, nullable=True)      # NEW mandatory for dropout
    previous_school     = Column(Text, nullable=True)      # NEW for transfer-in students
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    enrollments = relationship("Enrollment", back_populates="student",
                               order_by="Enrollment.academic_year_id")


# ─────────────────────────────────────────────────────────────────────────────
# Import Audit
# ─────────────────────────────────────────────────────────────────────────────

class ImportBatch(Base):
    __tablename__ = "import_batches"

    id                 = Column(Integer, primary_key=True)
    entity_type        = Column(String(32), nullable=False, index=True)
    file_name          = Column(String(255), nullable=False)
    file_format        = Column(String(16), nullable=False)
    merge_mode         = Column(String(32), nullable=False, default="skip_duplicates")
    status             = Column(Enum(ImportStatusEnum), nullable=False, default=ImportStatusEnum.completed, index=True)
    total_rows         = Column(Integer, nullable=False, default=0)
    imported_rows      = Column(Integer, nullable=False, default=0)
    skipped_rows       = Column(Integer, nullable=False, default=0)
    error_rows         = Column(Integer, nullable=False, default=0)
    summary            = Column(JSON, nullable=True)
    rollback_summary   = Column(JSON, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    rolled_back_at     = Column(DateTime(timezone=True), nullable=True)

    created_by = relationship("User")
    items = relationship("ImportBatchItem", back_populates="batch", cascade="all, delete-orphan")


class ImportBatchItem(Base):
    __tablename__ = "import_batch_items"

    id              = Column(Integer, primary_key=True)
    import_batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type     = Column(String(32), nullable=False, index=True)
    entity_id       = Column(Integer, nullable=True)
    action          = Column(String(32), nullable=False)
    payload         = Column(JSON, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("ImportBatch", back_populates="items")


# ─────────────────────────────────────────────────────────────────────────────
# Academic Content
# ─────────────────────────────────────────────────────────────────────────────

class Subject(Base):
    __tablename__ = "subjects"

    id              = Column(Integer, primary_key=True)
    name            = Column(String(100), nullable=False)
    code            = Column(String(20), nullable=True)     # NEW e.g. MATH, ENG
    class_id        = Column(Integer, ForeignKey("classes.id"))
    max_theory      = Column(Integer, default=100)
    max_practical   = Column(Integer, default=0)
    passing_marks   = Column(Integer, nullable=True)        # NEW explicit passing threshold
    subject_type    = Column(String(20), default="Theory")
    is_active       = Column(Boolean, default=True, nullable=False)
    is_exam_eligible = Column(Boolean, default=True, nullable=False)  # NEW

    exam_configs = relationship(
        "ExamSubjectConfig", back_populates="subject", cascade="all, delete-orphan"
    )


class Exam(Base):
    __tablename__ = "exams"

    id               = Column(Integer, primary_key=True)
    name             = Column(String(50), nullable=False)
    class_id         = Column(Integer, ForeignKey("classes.id"), index=True)
    exam_date        = Column(Date, nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), index=True)
    weightage        = Column(Numeric(5, 2), nullable=True)  # NEW % contribution to final

    subject_configs = relationship(
        "ExamSubjectConfig", back_populates="exam", cascade="all, delete-orphan"
    )


class ExamSubjectConfig(Base):
    __tablename__ = "exam_subject_configs"
    __table_args__ = (
        UniqueConstraint("exam_id", "subject_id", name="uq_exam_subject_config"),
    )

    id            = Column(Integer, primary_key=True)
    exam_id       = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    subject_id    = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    max_theory    = Column(Integer, nullable=False)
    max_practical = Column(Integer, nullable=False, default=0)

    exam    = relationship("Exam",    back_populates="subject_configs")
    subject = relationship("Subject", back_populates="exam_configs")


class Mark(Base):
    __tablename__ = "marks"
    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", "exam_id", name="uq_mark_student_subject_exam"),
    )

    id              = Column(Integer, primary_key=True)
    student_id      = Column(Integer, ForeignKey("students.id"))
    subject_id      = Column(Integer, ForeignKey("subjects.id"))
    exam_id         = Column(Integer, ForeignKey("exams.id"))
    theory_marks    = Column(Numeric(5, 2), nullable=True)
    practical_marks = Column(Numeric(5, 2), nullable=True)
    is_absent       = Column(Boolean, default=False)
    locked_at       = Column(DateTime(timezone=True), nullable=True)   # NEW


# ─────────────────────────────────────────────────────────────────────────────
# Report Cards  (NEW)
# ─────────────────────────────────────────────────────────────────────────────

class ReportCard(Base):
    __tablename__ = "report_cards"
    __table_args__ = (
        UniqueConstraint("enrollment_id", "exam_id", name="uq_report_card_enrollment_exam"),
    )

    id            = Column(Integer, primary_key=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    exam_id       = Column(Integer, ForeignKey("exams.id"), nullable=True)
    pdf_path      = Column(String(500), nullable=True)
    is_locked     = Column(Boolean, nullable=False, default=False)
    generated_at  = Column(DateTime(timezone=True), server_default=func.now())
    locked_at     = Column(DateTime(timezone=True), nullable=True)

    enrollment = relationship("Enrollment", back_populates="report_cards")


# ─────────────────────────────────────────────────────────────────────────────
# Fees
# ─────────────────────────────────────────────────────────────────────────────

class FeeHead(Base):
    __tablename__ = "fee_heads"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(100), nullable=False)
    frequency   = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True)


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

    id                = Column(Integer, primary_key=True)
    student_id        = Column(Integer, ForeignKey("students.id"), index=True)
    fee_structure_id  = Column(Integer, ForeignKey("fee_structures.id"))
    concession        = Column(Numeric(10, 2), default=0)
    net_amount        = Column(Numeric(10, 2), nullable=False)
    academic_year_id  = Column(Integer, ForeignKey("academic_years.id"), nullable=True, index=True)
    invoice_type      = Column(String(10), nullable=False, default="regular")  # NEW regular/arrear
    source_invoice_id = Column(Integer, ForeignKey("student_fees.id"), nullable=True)  # NEW for arrears


class FeePayment(Base):
    __tablename__ = "fee_payments"

    id             = Column(Integer, primary_key=True)
    student_fee_id = Column(Integer, ForeignKey("student_fees.id"))
    amount_paid    = Column(Numeric(10, 2), nullable=False)
    payment_date   = Column(Date, nullable=False, index=True)
    mode           = Column(String(20), nullable=False)
    receipt_number = Column(String(30), unique=True)
    collected_by   = Column(String(100), nullable=True)
    online_order_id = Column(Integer, ForeignKey("online_payment_orders.id"), nullable=True)
    notes          = Column(Text, nullable=True)


class OnlinePaymentOrder(Base):
    __tablename__ = "online_payment_orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('created', 'paid', 'failed', 'expired')",
            name="online_payment_status_check",
        ),
    )

    id                  = Column(Integer, primary_key=True)
    student_fee_id      = Column(Integer, ForeignKey("student_fees.id"), nullable=False)
    razorpay_order_id   = Column(Text, unique=True, nullable=False)
    razorpay_payment_id = Column(Text, nullable=True)
    razorpay_signature  = Column(Text, nullable=True)
    amount              = Column(Numeric(10, 2), nullable=False)
    currency            = Column(String(3), nullable=False, default="INR")
    status              = Column(String(20), nullable=False, default="created")
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    paid_at             = Column(DateTime(timezone=True), nullable=True)
    failure_reason      = Column(Text, nullable=True)


class TransferCertificate(Base):
    __tablename__ = "transfer_certificates"

    id          = Column(Integer, primary_key=True)
    tc_number   = Column(String(30), unique=True, nullable=False, index=True)
    student_id  = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    reason      = Column(Text, nullable=True)
    conduct     = Column(String(100), nullable=True)
    issued_at   = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# Attendance
# ─────────────────────────────────────────────────────────────────────────────

class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("student_id", "class_id", "date", name="uq_attendance_student_class_date"),
    )

    id         = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    class_id   = Column(Integer, ForeignKey("classes.id"))
    date       = Column(Date, nullable=False)
    status     = Column(String(5), nullable=False)


# ─────────────────────────────────────────────────────────────────────────────
# Audit Logs  (NEW)
# ─────────────────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id               = Column(Integer, primary_key=True)
    operation        = Column(Enum(AuditOperationEnum), nullable=False)
    performed_by     = Column(Integer, ForeignKey("users.id"), nullable=True)
    academic_year_id = Column(Integer, nullable=True)
    class_id         = Column(Integer, nullable=True)
    affected_count   = Column(Integer, nullable=True)
    payload          = Column(Text, nullable=True)    # JSON snapshot of before/after state
    result           = Column(String(20), nullable=False, default="success")
    error_detail     = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# Users & Auth
# ─────────────────────────────────────────────────────────────────────────────

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
    role          = Column(String(20), default="admin")
    is_active     = Column(Boolean, default=True)
    branch_id     = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)


class TeacherClassAssignment(Base):
    __tablename__ = "teacher_class_assignments"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id", "class_id", "academic_year_id", "subject_id",
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
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StudentActivationRequest(Base):
    __tablename__ = "student_activation_requests"

    id                    = Column(Integer, primary_key=True)
    activation_id         = Column(String(36), unique=True, nullable=False, index=True)
    student_id            = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    account_type          = Column(String(20), nullable=False)  # student / parent
    destination           = Column(String(255), nullable=False)
    destination_fingerprint = Column(String(64), nullable=False, index=True)
    status                = Column(String(20), nullable=False, default="pending")
    verified_at           = Column(DateTime(timezone=True), nullable=True)
    completed_at          = Column(DateTime(timezone=True), nullable=True)
    expires_at            = Column(DateTime(timezone=True), nullable=False, index=True)
    resend_count          = Column(Integer, nullable=False, default=0)
    locked_until          = Column(DateTime(timezone=True), nullable=True)
    request_ip            = Column(String(64), nullable=True)
    user_agent            = Column(String(255), nullable=True)
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student = relationship("Student")


class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    id                    = Column(Integer, primary_key=True)
    activation_request_id = Column(Integer, ForeignKey("student_activation_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    provider              = Column(String(20), nullable=False, default="email")
    destination_fingerprint = Column(String(64), nullable=False, index=True)
    otp_hash              = Column(String(128), nullable=False)
    expires_at            = Column(DateTime(timezone=True), nullable=False, index=True)
    verified_at           = Column(DateTime(timezone=True), nullable=True)
    attempt_count         = Column(Integer, nullable=False, default=0)
    max_attempts          = Column(Integer, nullable=False, default=5)
    resend_available_at   = Column(DateTime(timezone=True), nullable=False)
    created_at            = Column(DateTime(timezone=True), server_default=func.now())

    activation_request = relationship("StudentActivationRequest")


class NotificationOutbox(Base):
    __tablename__ = "notification_outbox"

    id              = Column(Integer, primary_key=True)
    provider        = Column(String(20), nullable=False)
    destination     = Column(String(255), nullable=False)
    subject         = Column(String(255), nullable=True)
    body            = Column(Text, nullable=False)
    payload         = Column(JSON, nullable=True)
    status          = Column(String(20), nullable=False, default="pending", index=True)
    attempts        = Column(Integer, nullable=False, default=0)
    max_attempts    = Column(Integer, nullable=False, default=3)
    next_attempt_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    last_error      = Column(Text, nullable=True)
    sent_at         = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NotificationLog(Base):
    __tablename__ = "notification_log"

    id                = Column(Integer, primary_key=True)
    student_id        = Column(Integer, ForeignKey("students.id"), nullable=True)
    notification_type = Column(String(40), nullable=False, index=True)
    channel           = Column(String(20), nullable=False, index=True)
    recipient_phone   = Column(String(20), nullable=False)
    template_name     = Column(String(100), nullable=True)
    message_preview   = Column(Text, nullable=True)
    status            = Column(String(20), nullable=False, default="queued", index=True)
    error_message     = Column(Text, nullable=True)
    idempotency_key   = Column(String(160), unique=True, nullable=True, index=True)
    outbox_id         = Column(Integer, ForeignKey("notification_outbox.id"), nullable=True)
    sent_at           = Column(DateTime(timezone=True), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# Relationships (post-class to avoid forward-ref issues)
# ─────────────────────────────────────────────────────────────────────────────

FeeStructure.fee_head = relationship("FeeHead", foreign_keys=[FeeStructure.fee_head_id])
StudentFee.student = relationship("Student", foreign_keys=[StudentFee.student_id])
StudentFee.fee_structure = relationship("FeeStructure", foreign_keys=[StudentFee.fee_structure_id])
StudentFee.payments = relationship("FeePayment", foreign_keys=[FeePayment.student_fee_id])
StudentFee.source_invoice = relationship("StudentFee", foreign_keys=[StudentFee.source_invoice_id], remote_side=[StudentFee.id])
OnlinePaymentOrder.student_fee = relationship("StudentFee", foreign_keys=[OnlinePaymentOrder.student_fee_id])
OnlinePaymentOrder.payment = relationship("FeePayment", foreign_keys=[FeePayment.online_order_id], uselist=False)
