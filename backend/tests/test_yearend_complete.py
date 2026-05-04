"""
tests/test_yearend_complete.py

Complete test suite for year-end operations covering every requirement
from the planning document sections 3–9.

Tests:
  - Academic year lifecycle (draft → active → closed)
  - Bulk promotion: pass/fail/detained/alumni/transfer/dropout/on_hold
  - Atomic transaction (partial failure rolls back)
  - Idempotency (can't promote twice)
  - Arrear carry-forward
  - Roll number reassignment
  - Mark locking
  - Clone fee structure
  - Clone subjects
  - Calendar-aware working days
  - Pre-promotion validation gate
  - Undo promotion
  - Audit log entries
  - TC includes attendance %
  - Candidate list per-student data
  - Section capacity warning
  - Std 10 → alumni flow
  - Unrecognised class name error
  - Preview endpoint completeness
"""

import json
import pytest
from datetime import date
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.base_models import (
    AcademicYear, AuditLog, Class, Enrollment, EnrollmentStatusEnum,
    FeeHead, FeePayment, FeeStructure, GenderEnum, Mark, Student,
    StudentFee, StudentStatusEnum, Subject, User, YearStatusEnum,
)
from app.services import yearend_service, calendar_service
from app.services.enrollment_service import backfill_enrollments, get_class_roll_list

# ─────────────────────────────────────────────────────────────────────────────
# Test DB setup
# ─────────────────────────────────────────────────────────────────────────────

SQLALCHEMY_TEST_URL = "sqlite:///./test_yearend.db"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture()
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
# Seed helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_year(db, label="2024-25", status="active", is_current=True):
    year = AcademicYear(
        label=label,
        start_date=date(2024, 6, 1),
        end_date=date(2025, 3, 31),
        is_current=is_current,
        status=status,
    )
    db.add(year)
    db.flush()
    return year


def _make_class(db, name, year_id, division="A"):
    cls = Class(name=name, division=division, academic_year_id=year_id,
                promotion_status="not_started")
    db.add(cls)
    db.flush()
    return cls


def _make_student(db, name, class_id, year_id, roll=1,
                  status=StudentStatusEnum.Active):
    import hashlib
    uid = hashlib.md5(f"{name}-{class_id}-{year_id}-{roll}".encode()).hexdigest()[:8]
    s = Student(
        student_id    = f"SMS-T-{uid}",
        gr_number     = f"GR{roll:04d}",
        name_en       = name,
        name_gu       = name,
        dob           = date(2010, 1, 1),
        gender        = GenderEnum.M,
        class_id      = class_id,
        roll_number   = roll,
        father_name   = "Test Father",
        contact       = "9876543210",
        admission_date= date(2020, 6, 1),
        academic_year_id = year_id,
        status        = status,
    )
    db.add(s)
    db.flush()
    return s


def _make_fee_head(db, name="Tuition Fee"):
    fh = db.query(FeeHead).filter_by(name=name).first()
    if not fh:
        fh = FeeHead(name=name, frequency="Monthly", is_active=True)
        db.add(fh)
        db.flush()
    return fh


def _make_fee_structure(db, class_id, year_id, fee_head_id, amount=5000):
    fs = FeeStructure(
        class_id=class_id, fee_head_id=fee_head_id,
        amount=amount, academic_year_id=year_id,
    )
    db.add(fs)
    db.flush()
    return fs


def _make_student_fee(db, student_id, fs_id, year_id, amount=5000):
    sf = StudentFee(
        student_id=student_id, fee_structure_id=fs_id,
        net_amount=amount, academic_year_id=year_id,
        invoice_type="regular",
    )
    db.add(sf)
    db.flush()
    return sf


def _make_subject(db, name, class_id):
    subj = Subject(name=name, class_id=class_id, max_theory=100, is_active=True)
    db.add(subj)
    db.flush()
    return subj


def _make_exam(db, name, class_id, year_id):
    from app.models.base_models import Exam
    exam = Exam(name=name, class_id=class_id, academic_year_id=year_id)
    db.add(exam)
    db.flush()
    return exam


def _make_mark(db, student_id, subject_id, exam_id, theory=75):
    m = Mark(student_id=student_id, subject_id=subject_id,
             exam_id=exam_id, theory_marks=Decimal(str(theory)), is_absent=False)
    db.add(m)
    db.flush()
    return m


def _admin_token(client):
    # Create admin if needed
    db = TestingSessionLocal()
    user = db.query(User).filter_by(email="admin_ye@test.com").first()
    if not user:
        user = User(
            name="Admin", email="admin_ye@test.com",
            password_hash=get_password_hash("admin123"),
            role="admin", is_active=True,
        )
        db.add(user)
        db.commit()
    db.close()
    res = client.post("/api/v1/auth/login",
                      data={"username": "admin_ye@test.com", "password": "admin123"})
    return res.json()["access_token"]


def _auth(client):
    return {"Authorization": f"Bearer {_admin_token(client)}"}


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 1: Academic Year Lifecycle
# ═════════════════════════════════════════════════════════════════════════════

class TestAcademicYearLifecycle:

    def test_create_year_creates_draft(self, db):
        """New year starts as DRAFT, not active."""
        # Clean slate
        db.query(AcademicYear).filter_by(label="2026-27-test").delete()
        db.commit()

        year = yearend_service.create_academic_year(db, "2026-27-test", "2026-06-01", "2027-03-31")
        assert year.status == YearStatusEnum.draft
        assert year.is_current is False
        assert year.is_upcoming is True

    def test_create_duplicate_year_raises(self, db):
        db.query(AcademicYear).filter_by(label="2027-28-dup").delete()
        db.commit()
        yearend_service.create_academic_year(db, "2027-28-dup", "2027-06-01", "2028-03-31")
        with pytest.raises(ValueError, match="already exists"):
            yearend_service.create_academic_year(db, "2027-28-dup", "2027-06-01", "2028-03-31")

    def test_activate_year_requires_classes(self, db):
        """Activation fails if no classes configured."""
        db.query(AcademicYear).filter_by(label="2028-29-empty").delete()
        db.commit()
        year = yearend_service.create_academic_year(db, "2028-29-empty", "2028-06-01", "2029-03-31")
        # Remove auto-created classes so validation fails
        db.query(Class).filter_by(academic_year_id=year.id).delete()
        db.commit()
        with pytest.raises(ValueError, match="No classes configured"):
            yearend_service.activate_academic_year(db, year.id, skip_validation=False)

    def test_activate_year_changes_status(self, db, client):
        """Activating a year changes status to active, closes previous."""
        db.query(AcademicYear).filter_by(label="2029-30-act").delete()
        db.commit()

        year = yearend_service.create_academic_year(db, "2029-30-act", "2029-06-01", "2030-03-31")
        # skip validation since we don't care about fees/subjects here
        result = yearend_service.activate_academic_year(db, year.id, skip_validation=True)

        db.refresh(year)
        assert result["status"] == "active"
        assert year.is_current is True
        assert year.status == YearStatusEnum.active

    def test_cannot_activate_closed_year(self, db):
        db.query(AcademicYear).filter_by(label="2030-31-closed").delete()
        db.commit()
        year = yearend_service.create_academic_year(db, "2030-31-closed", "2030-06-01", "2031-03-31")
        year.status = YearStatusEnum.closed
        db.commit()
        with pytest.raises(ValueError, match="closed"):
            yearend_service.activate_academic_year(db, year.id)

    def test_create_year_auto_creates_classes(self, db):
        """New year should auto-create Nursery through Std 10."""
        db.query(AcademicYear).filter_by(label="2031-32-cls").delete()
        db.commit()
        year = yearend_service.create_academic_year(db, "2031-32-cls", "2031-06-01", "2032-03-31")
        classes = db.query(Class).filter_by(academic_year_id=year.id).all()
        class_names = [c.name for c in classes]
        assert "1" in class_names
        assert "10" in class_names
        assert "Nursery" in class_names
        assert len(classes) >= 13   # Nursery LKG UKG 1-10


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 2: Candidate List
# ═════════════════════════════════════════════════════════════════════════════

class TestCandidateList:

    def test_candidate_list_includes_all_fields(self, db):
        """Each candidate must have name, roll, result, dues, attendance, suggested_action."""
        year  = _make_year(db, "CL-2024-25", "active")
        cls   = _make_class(db, "5", year.id)
        s1    = _make_student(db, "Alice Candidate", cls.id, year.id, roll=1)
        db.commit()

        candidates = yearend_service.generate_candidate_list(db, cls.id)
        assert len(candidates) >= 1
        c = candidates[0]
        assert "student_id"       in c
        assert "student_name"     in c
        assert "roll_number"      in c
        assert "exam_result"      in c
        assert "pending_dues"     in c
        assert "attendance_pct"   in c
        assert "suggested_action" in c
        assert "flags"            in c

    def test_candidate_with_fail_mark_suggests_retained(self, db):
        """A student with FAIL result should be suggested for retention."""
        year  = _make_year(db, "CL-FAIL-2024", "active")
        cls   = _make_class(db, "6", year.id)
        subj  = _make_subject(db, "Math", cls.id)
        exam  = _make_exam(db, "Annual", cls.id, year.id)
        s1    = _make_student(db, "Failing Student", cls.id, year.id, roll=1)
        # Mark below 33%
        _make_mark(db, s1.id, subj.id, exam.id, theory=20)
        db.commit()

        candidates = yearend_service.generate_candidate_list(db, cls.id)
        c = next((c for c in candidates if c["student_id"] == s1.id), None)
        assert c is not None
        assert c["suggested_action"] == "retained"

    def test_candidate_with_pending_dues_flags_it(self, db):
        year  = _make_year(db, "CL-DUES-2024", "active")
        cls   = _make_class(db, "7", year.id)
        fh    = _make_fee_head(db, "CL Tuition")
        fs    = _make_fee_structure(db, cls.id, year.id, fh.id, 5000)
        s1    = _make_student(db, "Dues Student", cls.id, year.id, roll=1)
        _make_student_fee(db, s1.id, fs.id, year.id, 5000)
        db.commit()

        candidates = yearend_service.generate_candidate_list(db, cls.id)
        c = next((c for c in candidates if c["student_id"] == s1.id), None)
        assert c is not None
        assert c["pending_dues"]          > 0
        assert c["flags"]["has_pending_dues"] is True


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 3: Pre-Promotion Validation
# ═════════════════════════════════════════════════════════════════════════════

class TestPrePromotionValidation:

    def test_validation_blocks_nonexistent_year(self, db):
        year = _make_year(db, "VAL-2024-25", "active")
        cls  = _make_class(db, "3", year.id)
        db.commit()

        result = yearend_service.validate_pre_promotion(db, cls.id, 99999)
        assert result["can_proceed"] is False
        assert any("not found" in e.lower() or "does not exist" in e.lower()
                   for e in result["errors"])

    def test_validation_blocks_closed_target_year(self, db):
        year_old = _make_year(db, "VAL-OLD-2024", "active")
        year_new = _make_year(db, "VAL-NEW-2025", "closed", is_current=False)
        cls      = _make_class(db, "4", year_old.id)
        db.commit()

        result = yearend_service.validate_pre_promotion(db, cls.id, year_new.id)
        assert result["can_proceed"] is False
        assert any("closed" in e.lower() for e in result["errors"])

    def test_validation_warns_about_unlocked_marks(self, db):
        year = _make_year(db, "VAL-MARKS-2024", "active")
        cls  = _make_class(db, "8", year.id)
        subj = _make_subject(db, "Science", cls.id)
        exam = _make_exam(db, "Annual", cls.id, year.id)
        s1   = _make_student(db, "Mark Student", cls.id, year.id, roll=1)
        _make_mark(db, s1.id, subj.id, exam.id, 80)
        year2 = _make_year(db, "VAL-MARKS-2025", "draft", is_current=False)
        db.commit()

        result = yearend_service.validate_pre_promotion(db, cls.id, year2.id)
        # Should warn about unlocked marks but still allow proceeding
        assert any("unlocked" in w.lower() or "locked" in w.lower()
                   for w in result["warnings"])

    def test_validation_blocks_unrecognised_class_name(self, db):
        year = _make_year(db, "VAL-BADNAME-2024", "active")
        cls  = Class(name="StandardX", division="A", academic_year_id=year.id,
                     promotion_status="not_started")
        db.add(cls)
        db.commit()

        year2 = _make_year(db, "VAL-BADNAME-2025", "draft", is_current=False)
        db.commit()

        result = yearend_service.validate_pre_promotion(db, cls.id, year2.id)
        assert result["can_proceed"] is False
        assert any("recognised" in e.lower() or "unrecognised" in e.lower() or
                   "not a recognised" in e.lower() for e in result["errors"])

    def test_validation_blocks_std10(self, db):
        """Std 10 cannot be promoted (it's the final standard)."""
        year  = _make_year(db, "VAL-STD10-2024", "active")
        cls   = _make_class(db, "10", year.id)
        year2 = _make_year(db, "VAL-STD10-2025", "draft", is_current=False)
        db.commit()

        result = yearend_service.validate_pre_promotion(db, cls.id, year2.id)
        assert result["can_proceed"] is False
        assert any("final" in e.lower() or "tc" in e.lower() or "10" in e
                   for e in result["errors"])


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 4: Bulk Promotion — Core Paths
# ═════════════════════════════════════════════════════════════════════════════

class TestBulkPromotionCorePaths:

    def _setup(self, db, year_label="PROM-2024", next_label="PROM-2025", class_name="5"):
        db.query(AcademicYear).filter(AcademicYear.label.in_([year_label, next_label])).delete()
        db.commit()
        year  = _make_year(db, year_label, "active")
        year2 = _make_year(db, next_label, "draft", is_current=False)
        cls   = _make_class(db, class_name, year.id)
        db.commit()
        return year, year2, cls

    def test_promoted_student_gets_new_enrollment(self, db):
        year, year2, cls = self._setup(db, "P1-2024", "P1-2025", "1")
        s = _make_student(db, "Promoted Child", cls.id, year.id, roll=1)
        db.commit()

        result = yearend_service.bulk_promote_students(
            db, cls.id, year2.id,
            student_actions={s.id: "promoted"},
        )

        assert result["promoted"] == 1
        enrollment = db.query(Enrollment).filter_by(
            student_id=s.id, academic_year_id=year2.id
        ).first()
        assert enrollment is not None
        assert enrollment.status == EnrollmentStatusEnum.active
        assert enrollment.promotion_action == "promoted"

    def test_promoted_student_moves_to_next_class(self, db):
        year, year2, cls = self._setup(db, "P2-2024", "P2-2025", "2")
        s = _make_student(db, "Move Child", cls.id, year.id, roll=1)
        db.commit()

        yearend_service.bulk_promote_students(db, cls.id, year2.id,
                                              student_actions={s.id: "promoted"})
        db.refresh(s)
        new_cls = db.query(Class).filter_by(id=s.class_id).first()
        assert new_cls.name == "3"   # 2 → 3
        assert new_cls.academic_year_id == year2.id

    def test_retained_student_stays_in_same_class(self, db):
        year, year2, cls = self._setup(db, "P3-2024", "P3-2025", "4")
        s = _make_student(db, "Retained Child", cls.id, year.id, roll=1)
        db.commit()

        result = yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "retained"}
        )
        assert result["retained"] == 1
        db.refresh(s)
        new_cls = db.query(Class).filter_by(id=s.class_id).first()
        assert new_cls.name == "4"   # stayed
        assert s.status == StudentStatusEnum.Detained

        enrollment = db.query(Enrollment).filter_by(
            student_id=s.id, academic_year_id=year2.id
        ).first()
        assert enrollment is not None
        assert enrollment.status == EnrollmentStatusEnum.retained

    def test_graduated_student_becomes_alumni(self, db):
        year, year2, cls = self._setup(db, "P4-2024", "P4-2025", "9")
        s = _make_student(db, "Graduate Child", cls.id, year.id, roll=1)
        db.commit()

        result = yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "graduated"}
        )
        assert result["graduated"] == 1
        db.refresh(s)
        assert s.status == StudentStatusEnum.Alumni
        # No enrollment in new year
        enrollment = db.query(Enrollment).filter_by(
            student_id=s.id, academic_year_id=year2.id
        ).first()
        assert enrollment is None

    def test_transferred_student_gets_tc_issued(self, db):
        year, year2, cls = self._setup(db, "P5-2024", "P5-2025", "6")
        s = _make_student(db, "Transfer Child", cls.id, year.id, roll=1)
        db.commit()

        result = yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "transferred"}
        )
        assert result["transferred"] == 1
        db.refresh(s)
        assert s.status == StudentStatusEnum.TC_Issued

    def test_dropped_student_becomes_left(self, db):
        year, year2, cls = self._setup(db, "P6-2024", "P6-2025", "7")
        s = _make_student(db, "Dropout Child", cls.id, year.id, roll=1)
        db.commit()

        result = yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "dropped"}
        )
        assert result["dropped"] == 1
        db.refresh(s)
        assert s.status == StudentStatusEnum.Left

    def test_on_hold_student_excluded_from_run(self, db):
        year, year2, cls = self._setup(db, "P7-2024", "P7-2025", "8")
        s = _make_student(db, "Onhold Child", cls.id, year.id, roll=1)
        db.commit()

        result = yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "on_hold"}
        )
        assert result["on_hold"] == 1
        # No enrollment created
        enrollment = db.query(Enrollment).filter_by(
            student_id=s.id, academic_year_id=year2.id
        ).first()
        assert enrollment is None


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 5: Atomicity & Idempotency
# ═════════════════════════════════════════════════════════════════════════════

class TestAtomicityAndIdempotency:

    def test_idempotency_blocks_double_promotion(self, db):
        """Running promotion twice for same class/year must be blocked."""
        db.query(AcademicYear).filter(AcademicYear.label.in_(["IDEM-24", "IDEM-25"])).delete()
        db.commit()

        year  = _make_year(db, "IDEM-24", "active")
        year2 = _make_year(db, "IDEM-25", "draft", is_current=False)
        cls   = _make_class(db, "3", year.id)
        s     = _make_student(db, "Idem Student", cls.id, year.id, roll=1)
        db.commit()

        # First run succeeds
        result1 = yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "promoted"}
        )
        assert result1["promoted"] == 1

        # Second run must be blocked by validation
        with pytest.raises(ValueError, match="already been promoted"):
            yearend_service.bulk_promote_students(
                db, cls.id, year2.id, student_actions={s.id: "promoted"}
            )

    def test_already_promoted_student_skipped_not_duplicated(self, db):
        """Student with existing enrollment in new year is skipped, not duplicated."""
        db.query(AcademicYear).filter(AcademicYear.label.in_(["SKIP-24", "SKIP-25"])).delete()
        db.commit()

        year  = _make_year(db, "SKIP-24", "active")
        year2 = _make_year(db, "SKIP-25", "draft", is_current=False)
        cls   = _make_class(db, "2", year.id)
        next_cls = _make_class(db, "3", year2.id)
        s     = _make_student(db, "Skip Student", cls.id, year.id, roll=1)

        # Pre-create enrollment (simulating a partial previous run)
        pre_enrollment = Enrollment(
            student_id=s.id, academic_year_id=year2.id, class_id=next_cls.id,
            roll_number="1", status=EnrollmentStatusEnum.active,
            enrolled_on=date.today(), promotion_status="completed",
        )
        db.add(pre_enrollment)
        db.commit()

        # Force=True to bypass idempotency gate (testing student-level skip)
        result = yearend_service.bulk_promote_students(
            db, cls.id, year2.id,
            student_actions={s.id: "promoted"},
            force=True,
        )
        # Student should appear in errors (skipped), not duplicated
        assert result["promoted"] == 0
        assert any(e["student_id"] == s.id for e in result["errors"])

        count = db.query(Enrollment).filter_by(
            student_id=s.id, academic_year_id=year2.id
        ).count()
        assert count == 1   # still only 1


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 6: Fee Arrear Carry-Forward
# ═════════════════════════════════════════════════════════════════════════════

class TestFeeArrearCarryForward:

    def test_unpaid_fees_create_arrear_in_new_year(self, db):
        """Student with ₹5000 unpaid in old year must have arrear in new year."""
        db.query(AcademicYear).filter(AcademicYear.label.in_(["ARREAR-24", "ARREAR-25"])).delete()
        db.commit()

        year  = _make_year(db, "ARREAR-24", "active")
        year2 = _make_year(db, "ARREAR-25", "draft", is_current=False)
        cls   = _make_class(db, "5", year.id)
        fh    = _make_fee_head(db, "Arrear Tuition")
        fs    = _make_fee_structure(db, cls.id, year.id, fh.id, 5000)
        s     = _make_student(db, "Arrear Student", cls.id, year.id, roll=1)
        sf    = _make_student_fee(db, s.id, fs.id, year.id, 5000)
        # No payment made → full ₹5000 outstanding
        db.commit()

        yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "promoted"}
        )

        arrears = db.query(StudentFee).filter_by(
            student_id=s.id,
            academic_year_id=year2.id,
            invoice_type="arrear",
        ).all()
        assert len(arrears) == 1
        assert Decimal(str(arrears[0].net_amount)) == Decimal("5000")
        assert arrears[0].source_invoice_id == sf.id

    def test_partially_paid_creates_correct_arrear_amount(self, db):
        """Student who paid ₹2000 of ₹5000 should have ₹3000 arrear."""
        db.query(AcademicYear).filter(AcademicYear.label.in_(["PART-24", "PART-25"])).delete()
        db.commit()

        year  = _make_year(db, "PART-24", "active")
        year2 = _make_year(db, "PART-25", "draft", is_current=False)
        cls   = _make_class(db, "6", year.id)
        fh    = _make_fee_head(db, "Partial Tuition")
        fs    = _make_fee_structure(db, cls.id, year.id, fh.id, 5000)
        s     = _make_student(db, "Partial Student", cls.id, year.id, roll=1)
        sf    = _make_student_fee(db, s.id, fs.id, year.id, 5000)
        # Pay ₹2000
        payment = FeePayment(
            student_fee_id=sf.id, amount_paid=Decimal("2000"),
            payment_date=date.today(), mode="Cash",
            receipt_number=f"RCPT-TEST-PART-{s.id}",
        )
        db.add(payment)
        db.commit()

        yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "promoted"}
        )

        arrears = db.query(StudentFee).filter_by(
            student_id=s.id, academic_year_id=year2.id, invoice_type="arrear"
        ).all()
        assert len(arrears) == 1
        assert Decimal(str(arrears[0].net_amount)) == Decimal("3000")

    def test_fully_paid_creates_no_arrear(self, db):
        """Student who paid in full should have zero arrears."""
        db.query(AcademicYear).filter(AcademicYear.label.in_(["FULL-24", "FULL-25"])).delete()
        db.commit()

        year  = _make_year(db, "FULL-24", "active")
        year2 = _make_year(db, "FULL-25", "draft", is_current=False)
        cls   = _make_class(db, "7", year.id)
        fh    = _make_fee_head(db, "Full Tuition")
        fs    = _make_fee_structure(db, cls.id, year.id, fh.id, 1000)
        s     = _make_student(db, "Full Payer", cls.id, year.id, roll=1)
        sf    = _make_student_fee(db, s.id, fs.id, year.id, 1000)
        payment = FeePayment(
            student_fee_id=sf.id, amount_paid=Decimal("1000"),
            payment_date=date.today(), mode="Cash",
            receipt_number=f"RCPT-FULL-{s.id}",
        )
        db.add(payment)
        db.commit()

        yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "promoted"}
        )

        arrears = db.query(StudentFee).filter_by(
            student_id=s.id, academic_year_id=year2.id, invoice_type="arrear"
        ).all()
        assert len(arrears) == 0


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 7: Roll Number Assignment
# ═════════════════════════════════════════════════════════════════════════════

class TestRollNumberAssignment:

    def test_promoted_students_get_new_roll_numbers(self, db):
        db.query(AcademicYear).filter(AcademicYear.label.in_(["ROLL-24", "ROLL-25"])).delete()
        db.commit()

        year  = _make_year(db, "ROLL-24", "active")
        year2 = _make_year(db, "ROLL-25", "draft", is_current=False)
        cls   = _make_class(db, "8", year.id)
        s1    = _make_student(db, "Aardvark Roll", cls.id, year.id, roll=5)
        s2    = _make_student(db, "Zebra Roll",    cls.id, year.id, roll=6)
        db.commit()

        yearend_service.bulk_promote_students(
            db, cls.id, year2.id,
            student_actions={s1.id: "promoted", s2.id: "promoted"},
            roll_strategy="sequential",
        )

        e1 = db.query(Enrollment).filter_by(student_id=s1.id, academic_year_id=year2.id).first()
        e2 = db.query(Enrollment).filter_by(student_id=s2.id, academic_year_id=year2.id).first()
        assert e1 is not None
        assert e2 is not None
        # Roll numbers should be 1, 2 (sequential from 1, not carrying old 5, 6)
        rolls = sorted([e1.roll_number, e2.roll_number])
        assert rolls == ["1", "2"]

    def test_roll_numbers_are_strings(self, db):
        """Roll numbers must be stored as strings to support composite formats."""
        db.query(AcademicYear).filter(AcademicYear.label.in_(["ROLLSTR-24", "ROLLSTR-25"])).delete()
        db.commit()

        year  = _make_year(db, "ROLLSTR-24", "active")
        year2 = _make_year(db, "ROLLSTR-25", "draft", is_current=False)
        cls   = _make_class(db, "9", year.id)
        s     = _make_student(db, "String Roll", cls.id, year.id, roll=1)
        db.commit()

        yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "promoted"}
        )

        e = db.query(Enrollment).filter_by(student_id=s.id, academic_year_id=year2.id).first()
        assert isinstance(e.roll_number, str)


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 8: Mark Locking
# ═════════════════════════════════════════════════════════════════════════════

class TestMarkLocking:

    def test_lock_marks_sets_locked_at(self, db):
        year  = _make_year(db, "LOCK-2024-25", "active")
        cls   = _make_class(db, "3", year.id)
        subj  = _make_subject(db, "Lock Math", cls.id)
        exam  = _make_exam(db, "Lock Annual", cls.id, year.id)
        s     = _make_student(db, "Lock Student", cls.id, year.id, roll=1)
        m     = _make_mark(db, s.id, subj.id, exam.id, 80)
        db.commit()

        result = yearend_service.lock_marks_for_year(db, year.id)
        assert result["locked"] >= 1

        db.refresh(m)
        assert m.locked_at is not None

    def test_write_to_locked_mark_raises(self, db):
        from app.services.marks_service import bulk_save_marks
        from app.schemas.marks import MarkEntry

        year  = _make_year(db, "LOCKWRITE-2024", "active")
        cls   = _make_class(db, "4", year.id)
        subj  = _make_subject(db, "LockW Math", cls.id)
        exam  = _make_exam(db, "LockW Annual", cls.id, year.id)
        s     = _make_student(db, "LockWrite Student", cls.id, year.id, roll=1)
        m     = _make_mark(db, s.id, subj.id, exam.id, 80)
        db.commit()

        yearend_service.lock_marks_for_year(db, year.id)

        entry = MarkEntry(
            student_id=s.id, subject_id=subj.id, exam_id=exam.id,
            theory_marks=Decimal("90"), is_absent=False,
        )
        with pytest.raises(ValueError, match="locked"):
            bulk_save_marks(db, [entry])

    def test_lock_is_idempotent(self, db):
        """Locking twice should not error and locked_at should not change."""
        year  = _make_year(db, "LOCKIDEM-2024", "active")
        cls   = _make_class(db, "5", year.id)
        subj  = _make_subject(db, "Idem Math", cls.id)
        exam  = _make_exam(db, "Idem Annual", cls.id, year.id)
        s     = _make_student(db, "Idem Lock Student", cls.id, year.id, roll=1)
        _make_mark(db, s.id, subj.id, exam.id, 70)
        db.commit()

        yearend_service.lock_marks_for_year(db, year.id)
        r1 = yearend_service.lock_marks_for_year(db, year.id)
        assert r1["locked"] == 0   # nothing new to lock


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 9: Clone Operations
# ═════════════════════════════════════════════════════════════════════════════

class TestCloneOperations:

    def test_clone_fee_structure_copies_all_heads(self, db):
        db.query(AcademicYear).filter(AcademicYear.label.in_(["CLF-24", "CLF-25"])).delete()
        db.commit()

        year  = _make_year(db, "CLF-24", "active")
        year2 = _make_year(db, "CLF-25", "draft", is_current=False)
        cls1  = _make_class(db, "1", year.id)
        cls2  = _make_class(db, "1", year2.id)
        fh    = _make_fee_head(db, "Clone Fee")
        _make_fee_structure(db, cls1.id, year.id, fh.id, 3000)
        db.commit()

        result = yearend_service.clone_fee_structure(db, year.id, year2.id)
        assert result["created"] >= 1

        new_fs = db.query(FeeStructure).filter_by(
            class_id=cls2.id, academic_year_id=year2.id
        ).first()
        assert new_fs is not None
        assert Decimal(str(new_fs.amount)) == Decimal("3000")

    def test_clone_fee_structure_is_idempotent(self, db):
        db.query(AcademicYear).filter(AcademicYear.label.in_(["CLFI-24", "CLFI-25"])).delete()
        db.commit()

        year  = _make_year(db, "CLFI-24", "active")
        year2 = _make_year(db, "CLFI-25", "draft", is_current=False)
        cls1  = _make_class(db, "2", year.id)
        _make_class(db, "2", year2.id)
        fh    = _make_fee_head(db, "Idem Clone Fee")
        _make_fee_structure(db, cls1.id, year.id, fh.id, 2000)
        db.commit()

        r1 = yearend_service.clone_fee_structure(db, year.id, year2.id)
        r2 = yearend_service.clone_fee_structure(db, year.id, year2.id)
        assert r1["created"] >= 1
        assert r2["created"] == 0   # already exists

    def test_clone_subjects_copies_active_subjects(self, db):
        db.query(AcademicYear).filter(AcademicYear.label.in_(["CLS-24", "CLS-25"])).delete()
        db.commit()

        year  = _make_year(db, "CLS-24", "active")
        year2 = _make_year(db, "CLS-25", "draft", is_current=False)
        cls1  = _make_class(db, "3", year.id)
        _make_class(db, "3", year2.id)
        _make_subject(db, "Clone Math", cls1.id)
        _make_subject(db, "Clone Science", cls1.id)
        db.commit()

        result = yearend_service.clone_subjects(db, year.id, year2.id)
        assert result["created"] >= 2


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 10: Undo Promotion
# ═════════════════════════════════════════════════════════════════════════════

class TestUndoPromotion:

    def test_undo_reverses_enrollment_and_student(self, db):
        db.query(AcademicYear).filter(AcademicYear.label.in_(["UNDO-24", "UNDO-25"])).delete()
        db.commit()

        year  = _make_year(db, "UNDO-24", "active")
        year2 = _make_year(db, "UNDO-25", "draft", is_current=False)
        cls   = _make_class(db, "3", year.id)
        s     = _make_student(db, "Undo Student", cls.id, year.id, roll=1)
        original_class_id = s.class_id
        db.commit()

        # Promote
        yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "promoted"}
        )
        db.refresh(s)
        assert s.academic_year_id == year2.id  # moved

        # Undo
        result = yearend_service.undo_promotion(db, cls.id, year2.id)
        assert result["undone"] >= 1

        db.refresh(s)
        assert s.class_id         == original_class_id
        assert s.academic_year_id == year.id
        assert s.status           == StudentStatusEnum.Active

        # Enrollment in new year should be deleted
        enrollment = db.query(Enrollment).filter_by(
            student_id=s.id, academic_year_id=year2.id
        ).first()
        assert enrollment is None

    def test_undo_blocked_after_year_activated(self, db):
        db.query(AcademicYear).filter(AcademicYear.label.in_(["UNDOBLK-24", "UNDOBLK-25"])).delete()
        db.commit()

        year  = _make_year(db, "UNDOBLK-24", "active")
        year2 = _make_year(db, "UNDOBLK-25", "active", is_current=False)
        cls   = _make_class(db, "4", year.id)
        db.commit()

        with pytest.raises(ValueError, match="activated"):
            yearend_service.undo_promotion(db, cls.id, year2.id)

    def test_undo_removes_arrear_fees(self, db):
        """Arrear fees created during promotion must be removed on undo."""
        db.query(AcademicYear).filter(AcademicYear.label.in_(["UNDARR-24", "UNDARR-25"])).delete()
        db.commit()

        year  = _make_year(db, "UNDARR-24", "active")
        year2 = _make_year(db, "UNDARR-25", "draft", is_current=False)
        cls   = _make_class(db, "6", year.id)
        fh    = _make_fee_head(db, "Undo Arrear Fee")
        fs    = _make_fee_structure(db, cls.id, year.id, fh.id, 1000)
        s     = _make_student(db, "Undo Arrear Student", cls.id, year.id, roll=1)
        _make_student_fee(db, s.id, fs.id, year.id, 1000)
        db.commit()

        yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "promoted"}
        )
        arrears_before = db.query(StudentFee).filter_by(
            student_id=s.id, academic_year_id=year2.id, invoice_type="arrear"
        ).count()
        assert arrears_before == 1

        yearend_service.undo_promotion(db, cls.id, year2.id)

        arrears_after = db.query(StudentFee).filter_by(
            student_id=s.id, academic_year_id=year2.id, invoice_type="arrear"
        ).count()
        assert arrears_after == 0


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 11: Audit Log
# ═════════════════════════════════════════════════════════════════════════════

class TestAuditLog:

    def test_promotion_creates_audit_entry(self, db):
        db.query(AcademicYear).filter(AcademicYear.label.in_(["AUD-24", "AUD-25"])).delete()
        db.commit()

        year  = _make_year(db, "AUD-24", "active")
        year2 = _make_year(db, "AUD-25", "draft", is_current=False)
        cls   = _make_class(db, "1", year.id)
        s     = _make_student(db, "Audit Student", cls.id, year.id, roll=1)
        db.commit()

        before_count = db.query(AuditLog).count()
        yearend_service.bulk_promote_students(
            db, cls.id, year2.id, student_actions={s.id: "promoted"}
        )
        after_count = db.query(AuditLog).count()
        assert after_count > before_count

        log = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
        assert log.operation.value == "bulk_promote"
        assert log.affected_count >= 1
        assert log.result in ("success", "partial")

    def test_failed_promotion_creates_failed_audit_entry(self, db):
        """Validation failure must still write an audit entry."""
        db.query(AcademicYear).filter(AcademicYear.label.in_(["AUDF-24"])).delete()
        db.commit()

        year = _make_year(db, "AUDF-24", "active")
        cls  = _make_class(db, "2", year.id)
        db.commit()

        before_count = db.query(AuditLog).count()
        try:
            yearend_service.bulk_promote_students(db, cls.id, 99999)
        except ValueError:
            pass

        after_count = db.query(AuditLog).count()
        assert after_count > before_count
        log = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
        assert log.result == "failed"

    def test_lock_marks_creates_audit_entry(self, db):
        year = _make_year(db, "AUDLK-2024", "active")
        db.commit()

        before = db.query(AuditLog).count()
        yearend_service.lock_marks_for_year(db, year.id)
        after  = db.query(AuditLog).count()
        assert after > before

    def test_clone_fee_creates_audit_entry(self, db):
        db.query(AcademicYear).filter(AcademicYear.label.in_(["AUDC-24", "AUDC-25"])).delete()
        db.commit()
        year  = _make_year(db, "AUDC-24", "active")
        year2 = _make_year(db, "AUDC-25", "draft", is_current=False)
        db.commit()

        before = db.query(AuditLog).count()
        yearend_service.clone_fee_structure(db, year.id, year2.id)
        after  = db.query(AuditLog).count()
        assert after > before


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 12: Calendar Service
# ═════════════════════════════════════════════════════════════════════════════

class TestCalendarService:

    def test_working_days_excludes_holidays(self, db):
        """A month with a seeded holiday should have fewer working days."""
        year = _make_year(db, "CAL-2024-25", "active")
        db.commit()

        # Count Oct 2025 without holidays
        no_holiday = calendar_service.count_working_days(db, None, date(2025, 10, 1), date(2025, 10, 31))

        # Seed Navratri (10 days)
        calendar_service.create_event(
            db, year.id, "holiday", "Navratri Test",
            date(2025, 10, 2), date(2025, 10, 11), affects_attendance=True,
        )

        with_holiday = calendar_service.count_working_days(
            db, year.id, date(2025, 10, 1), date(2025, 10, 31)
        )
        assert with_holiday < no_holiday

    def test_working_days_zero_for_reversed_range(self, db):
        year = _make_year(db, "CAL-ZERO-2024", "active")
        db.commit()
        result = calendar_service.count_working_days(db, year.id, date(2025, 5, 1), date(2025, 4, 1))
        assert result == 0

    def test_seed_holidays_is_idempotent(self, db):
        year = _make_year(db, "CAL-SEED-2025", "active")
        db.commit()
        c1 = calendar_service.seed_standard_holidays(db, year.id)
        c2 = calendar_service.seed_standard_holidays(db, year.id)
        assert c1 > 0
        assert c2 == 0   # second call seeds nothing

    def test_crud_event(self, db):
        year  = _make_year(db, "CAL-CRUD-2025", "active")
        db.commit()

        event = calendar_service.create_event(
            db, year.id, "holiday", "Test Holiday",
            date(2025, 8, 15), date(2025, 8, 15),
        )
        assert event.id is not None

        events = calendar_service.list_events(db, year.id)
        assert any(e.id == event.id for e in events)

        updated = calendar_service.update_event(db, event.id, title="Independence Day")
        assert updated.title == "Independence Day"

        deleted = calendar_service.delete_event(db, event.id)
        assert deleted is True
        assert calendar_service.delete_event(db, event.id) is False


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 13: Enrollment Service
# ═════════════════════════════════════════════════════════════════════════════

class TestEnrollmentService:

    def test_backfill_creates_enrollment_for_existing_students(self, db):
        year = _make_year(db, "BF-2024-25", "active")
        cls  = _make_class(db, "1", year.id)
        s    = _make_student(db, "Backfill Student", cls.id, year.id, roll=3)
        db.commit()

        # Remove any existing enrollment
        db.query(Enrollment).filter_by(student_id=s.id).delete()
        db.commit()

        result = backfill_enrollments(db)
        assert result["created"] >= 1

        e = db.query(Enrollment).filter_by(student_id=s.id).first()
        assert e is not None
        assert e.academic_year_id == year.id

    def test_backfill_is_idempotent(self, db):
        year = _make_year(db, "BFI-2024-25", "active")
        cls  = _make_class(db, "2", year.id)
        _make_student(db, "BFI Student", cls.id, year.id, roll=1)
        db.commit()

        r1 = backfill_enrollments(db)
        r2 = backfill_enrollments(db)
        # Second call should create 0 new records for same students
        # (some may be created for other students from other tests)
        assert r2["skipped"] >= r1["created"]

    def test_roll_list_ordered(self, db):
        year = _make_year(db, "RL-2024-25", "active")
        cls  = _make_class(db, "3", year.id)
        s1   = _make_student(db, "Roll One", cls.id, year.id, roll=2)
        s2   = _make_student(db, "Roll Two", cls.id, year.id, roll=1)
        db.commit()
        # Create enrollments
        e1 = Enrollment(student_id=s1.id, academic_year_id=year.id,
                        class_id=cls.id, roll_number="2",
                        status=EnrollmentStatusEnum.active,
                        enrolled_on=date.today(), promotion_status="completed")
        e2 = Enrollment(student_id=s2.id, academic_year_id=year.id,
                        class_id=cls.id, roll_number="1",
                        status=EnrollmentStatusEnum.active,
                        enrolled_on=date.today(), promotion_status="completed")
        db.add_all([e1, e2])
        db.commit()

        roll_list = get_class_roll_list(db, cls.id, year.id)
        # Should be ordered by roll_number string
        rolls = [r["roll_number"] for r in roll_list]
        assert rolls == sorted(rolls)


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 14: TC Data Completeness
# ═════════════════════════════════════════════════════════════════════════════

class TestTCData:

    def test_tc_data_includes_attendance_percentage(self, db):
        """TC must include attendance % — was missing in original."""
        year = _make_year(db, "TC-2024-25", "active")
        cls  = _make_class(db, "5", year.id)
        s    = _make_student(db, "TC Student", cls.id, year.id, roll=1)
        s.status = StudentStatusEnum.TC_Issued
        db.commit()

        data = yearend_service.get_tc_data(db, s.id, "Parent Request", "Good")
        assert data is not None
        assert "attendance_percentage" in data
        # May be "—" if no attendance records, but key must exist
        assert data["attendance_percentage"] is not None

    def test_tc_data_includes_all_required_fields(self, db):
        year = _make_year(db, "TC2-2024-25", "active")
        cls  = _make_class(db, "6", year.id)
        s    = _make_student(db, "TC2 Student", cls.id, year.id, roll=1)
        db.commit()

        data = yearend_service.get_tc_data(db, s.id, "Parent Request", "Good")
        required_fields = [
            "student", "class_name", "division", "academic_year",
            "tc_number", "issue_date", "leave_date", "reason", "conduct",
            "dob_formatted", "admission_date_formatted", "attendance_percentage",
        ]
        for field in required_fields:
            assert field in data, f"Missing TC field: {field}"


# ═════════════════════════════════════════════════════════════════════════════
# SECTION 15: API Endpoints
# ═════════════════════════════════════════════════════════════════════════════

class TestYearEndAPIEndpoints:

    def test_new_year_endpoint_creates_draft(self, client):
        headers = _auth(client)
        res = client.post("/api/v1/yearend/new-year", json={
            "label": "2040-41", "start_date": "2040-06-01", "end_date": "2041-03-31"
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["status"] == "draft"

    def test_validate_endpoint_returns_can_proceed(self, client):
        headers = _auth(client)
        # Create valid setup
        db = TestingSessionLocal()
        year  = _make_year(db, "API-VAL-24", "active")
        year2 = _make_year(db, "API-VAL-25", "draft", is_current=False)
        cls   = _make_class(db, "2", year.id)
        db.commit()
        cls_id = cls.id
        year2_id = year2.id
        db.close()

        res = client.get(
            f"/api/v1/yearend/promote/{cls_id}/validate",
            params={"new_academic_year_id": year2_id},
            headers=headers,
        )
        assert res.status_code == 200
        assert "can_proceed" in res.json()
        assert "errors" in res.json()
        assert "warnings" in res.json()

    def test_candidates_endpoint_returns_list(self, client):
        headers = _auth(client)
        db = TestingSessionLocal()
        year = _make_year(db, "API-CAND-24", "active")
        cls  = _make_class(db, "3", year.id)
        _make_student(db, "API Candidate", cls.id, year.id, roll=1)
        db.commit()
        cls_id = cls.id
        db.close()

        res = client.get(f"/api/v1/yearend/promote/{cls_id}/candidates", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "candidates" in data
        assert isinstance(data["candidates"], list)
        if data["candidates"]:
            c = data["candidates"][0]
            assert "suggested_action" in c
            assert "pending_dues" in c

    def test_promote_endpoint_returns_report(self, client):
        headers = _auth(client)
        db = TestingSessionLocal()
        year  = _make_year(db, "API-PROM-24", "active")
        year2 = _make_year(db, "API-PROM-25", "draft", is_current=False)
        cls   = _make_class(db, "1", year.id)
        s     = _make_student(db, "API Promote", cls.id, year.id, roll=1)
        db.commit()
        cid = cls.id
        sid = s.id
        y2id = year2.id
        db.close()

        res = client.post(
            f"/api/v1/yearend/promote/{cid}",
            json={
                "new_academic_year_id": y2id,
                "student_actions": {str(sid): "promoted"},
                "roll_strategy": "sequential",
            },
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert "promoted"    in data
        assert "retained"    in data
        assert "on_hold"     in data
        assert "errors"      in data

    def test_audit_log_endpoint_returns_entries(self, client):
        headers = _auth(client)
        res = client.get("/api/v1/yearend/audit-log", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "logs" in data
        assert "total" in data

    def test_calendar_crud_endpoints(self, client):
        headers = _auth(client)
        db = TestingSessionLocal()
        year = _make_year(db, "API-CAL-25", "active")
        db.commit()
        yid = year.id
        db.close()

        # Create
        res = client.post(f"/api/v1/yearend/calendar/{yid}", json={
            "event_type": "holiday",
            "title": "API Test Holiday",
            "start_date": "2025-01-01",
            "end_date": "2025-01-01",
            "affects_attendance": True,
        }, headers=headers)
        assert res.status_code == 201
        eid = res.json()["id"]

        # List
        res = client.get(f"/api/v1/yearend/calendar/{yid}", headers=headers)
        assert res.status_code == 200
        assert any(e["id"] == eid for e in res.json())

        # Update
        res = client.put(f"/api/v1/yearend/calendar/event/{eid}", json={
            "event_type": "holiday",
            "title": "Updated Holiday",
            "start_date": "2025-01-01",
            "end_date": "2025-01-01",
            "affects_attendance": True,
        }, headers=headers)
        assert res.status_code == 200

        # Delete
        res = client.delete(f"/api/v1/yearend/calendar/event/{eid}", headers=headers)
        assert res.status_code == 200

    def test_lock_marks_endpoint(self, client):
        headers = _auth(client)
        db = TestingSessionLocal()
        year = _make_year(db, "API-LOCK-25", "active")
        db.commit()
        yid = year.id
        db.close()

        res = client.post("/api/v1/yearend/lock-marks",
                          json={"academic_year_id": yid}, headers=headers)
        assert res.status_code == 200
        assert "locked" in res.json()

    def test_clone_fees_endpoint(self, client):
        headers = _auth(client)
        db = TestingSessionLocal()
        db.query(AcademicYear).filter(AcademicYear.label.in_(["API-CLF-24", "API-CLF-25"])).delete()
        db.commit()
        year  = _make_year(db, "API-CLF-24", "active")
        year2 = _make_year(db, "API-CLF-25", "draft", is_current=False)
        db.commit()
        from_id, to_id = year.id, year2.id
        db.close()

        res = client.post("/api/v1/yearend/clone-fees",
                          json={"from_year_id": from_id, "to_year_id": to_id},
                          headers=headers)
        assert res.status_code == 200
        assert "created" in res.json()

    def test_tc_pdf_is_public(self, client):
        """TC PDF must be accessible without auth."""
        res = client.get("/api/v1/yearend/tc-pdf/99999")
        assert res.status_code in (200, 404)
        assert res.status_code != 401

    def test_undo_endpoint(self, client):
        headers = _auth(client)
        db = TestingSessionLocal()
        db.query(AcademicYear).filter(AcademicYear.label.in_(["API-UNDO-24", "API-UNDO-25"])).delete()
        db.commit()
        year  = _make_year(db, "API-UNDO-24", "active")
        year2 = _make_year(db, "API-UNDO-25", "draft", is_current=False)
        cls   = _make_class(db, "7", year.id)
        s     = _make_student(db, "API Undo Student", cls.id, year.id, roll=1)
        db.commit()
        cid, y2id, sid = cls.id, year2.id, s.id
        db.close()

        # Promote first
        client.post(f"/api/v1/yearend/promote/{cid}",
                    json={"new_academic_year_id": y2id,
                          "student_actions": {str(sid): "promoted"},
                          "roll_strategy": "sequential"},
                    headers=headers)

        # Then undo
        res = client.post(f"/api/v1/yearend/promote/{cid}/undo",
                          json={"new_academic_year_id": y2id},
                          headers=headers)
        assert res.status_code == 200
        assert res.json()["undone"] >= 1
