"""
tests/test_portal_auto_link.py

Tests for the portal account auto-generation system:
  - GET  /api/v1/admin/portal/link-status
  - POST /api/v1/admin/portal/bulk-generate
  - POST /api/v1/admin/portal/generate/{student_id}

Covers:
  - Link status statistics
  - Bulk account generation (idempotency, correct counts)
  - Per-student account generation
  - RBAC enforcement (non-admin users cannot call these endpoints)
  - Email uniqueness (no duplicate emails on re-run)
  - Password is student DOB in DDMMYYYY format
"""

import pytest
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import get_password_hash, verify_password
from app.main import app
from app.models.base_models import (
    AcademicYear, Class, GenderEnum, Student, StudentStatusEnum, User,
)

# ── In-memory SQLite test database ────────────────────────────────────────────
SQLALCHEMY_TEST_URL = "sqlite:///./test_portal_link.db"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    year = AcademicYear(
        label="2026-27",
        start_date=date(2026, 6, 1),
        end_date=date(2027, 3, 31),
        is_current=True,
    )
    db.add(year)
    db.flush()

    cls = Class(name="7", division="A", academic_year_id=year.id)
    db.add(cls)
    db.flush()

    # Admin user
    admin = User(
        name="Admin",
        email="autoadmin@test.com",
        password_hash=get_password_hash("admin1234"),
        role="admin",
        is_active=True,
    )
    # Non-admin (teacher) — should be forbidden
    teacher = User(
        name="Teacher",
        email="autoteacher@test.com",
        password_hash=get_password_hash("teacher1234"),
        role="teacher",
        is_active=True,
    )
    db.add_all([admin, teacher])
    db.flush()

    # Student WITHOUT portal accounts (should be auto-generated)
    s1 = Student(
        student_id="SMS-2026-001",
        name_en="Alice Smith",
        name_gu="એલિસ",
        dob=date(2014, 8, 15),
        gender=GenderEnum.F,
        class_id=cls.id,
        father_name="Bob Smith",
        contact="9876543210",
        admission_date=date(2026, 6, 1),
        academic_year_id=year.id,
        status=StudentStatusEnum.Active,
        student_user_id=None,
        parent_user_id=None,
    )
    # Student WITH both accounts already linked (should be skipped)
    pre_student_user = User(
        name="Pre Student",
        email="pre.student@test.com",
        password_hash=get_password_hash("dummy"),
        role="student",
        is_active=True,
    )
    pre_parent_user = User(
        name="Pre Parent",
        email="pre.parent@test.com",
        password_hash=get_password_hash("dummy"),
        role="parent",
        is_active=True,
    )
    db.add_all([pre_student_user, pre_parent_user])
    db.flush()

    s2 = Student(
        student_id="SMS-2026-002",
        name_en="Charlie Brown",
        name_gu="ચાર્લી",
        dob=date(2013, 3, 22),
        gender=GenderEnum.M,
        class_id=cls.id,
        father_name="David Brown",
        contact="9876543211",
        admission_date=date(2026, 6, 1),
        academic_year_id=year.id,
        status=StudentStatusEnum.Active,
        student_user_id=pre_student_user.id,
        parent_user_id=pre_parent_user.id,
    )
    db.add_all([s1, s2])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _token(client, email, password):
    res = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ══════════════════════════════════════════════════════════════════════════════
# 1. Link Status
# ══════════════════════════════════════════════════════════════════════════════

class TestLinkStatus:
    def test_returns_correct_counts(self, client):
        tok = _token(client, "autoadmin@test.com", "admin1234")
        res = client.get("/api/v1/admin/portal/link-status", headers=_auth(tok))
        assert res.status_code == 200
        data = res.json()
        # 2 active students total
        assert data["total_active_students"] == 2
        # s2 already has both accounts, s1 has none
        assert data["students_with_portal_account"] == 1
        assert data["students_without_portal_account"] == 1
        assert data["students_with_parent_account"] == 1
        assert data["students_without_parent_account"] == 1
        # unlinked_students list contains s1 only
        assert len(data["unlinked_students"]) == 1
        unlinked = data["unlinked_students"][0]
        assert unlinked["student_id"] == "SMS-2026-001"
        assert unlinked["has_student_account"] is False
        assert unlinked["has_parent_account"] is False

    def test_teacher_cannot_access_link_status(self, client):
        tok = _token(client, "autoteacher@test.com", "teacher1234")
        res = client.get("/api/v1/admin/portal/link-status", headers=_auth(tok))
        assert res.status_code == 403

    def test_unauthenticated_request_rejected(self, client):
        res = client.get("/api/v1/admin/portal/link-status")
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 2. Per-student generation
# ══════════════════════════════════════════════════════════════════════════════

class TestGenerateForStudent:
    def test_generates_accounts_for_unlinked_student(self, client):
        db = TestingSessionLocal()
        s1 = db.query(Student).filter_by(student_id="SMS-2026-001").first()
        db.close()

        tok = _token(client, "autoadmin@test.com", "admin1234")
        res = client.post(
            f"/api/v1/admin/portal/generate/{s1.id}",
            headers=_auth(tok),
            params={"include_students": True, "include_parents": True},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["student_account_created"] is True
        assert data["parent_account_created"] is True
        assert data["student_email"] is not None
        assert data["parent_email"] is not None

    def test_student_can_now_login(self, client):
        """After generation, student should be able to login with DOB as password."""
        # DOB of SMS-2026-001 is 2014-08-15 → "15082014"
        expected_password = "15082014"
        db = TestingSessionLocal()
        s1 = db.query(Student).filter_by(student_id="SMS-2026-001").first()
        student_user = db.query(User).filter_by(id=s1.student_user_id).first()
        assert student_user is not None
        assert verify_password(expected_password, student_user.password_hash)
        db.close()

    def test_parent_can_now_login(self, client):
        expected_password = "15082014"
        db = TestingSessionLocal()
        s1 = db.query(Student).filter_by(student_id="SMS-2026-001").first()
        parent_user = db.query(User).filter_by(id=s1.parent_user_id).first()
        assert parent_user is not None
        assert parent_user.role == "parent"
        assert verify_password(expected_password, parent_user.password_hash)
        db.close()

    def test_generate_is_idempotent(self, client):
        """Re-running generate for the same student should not create new accounts."""
        db = TestingSessionLocal()
        s1 = db.query(Student).filter_by(student_id="SMS-2026-001").first()
        original_student_user_id = s1.student_user_id
        original_parent_user_id = s1.parent_user_id
        db.close()

        tok = _token(client, "autoadmin@test.com", "admin1234")
        res = client.post(
            f"/api/v1/admin/portal/generate/{s1.id}",
            headers=_auth(tok),
            params={"include_students": True, "include_parents": True},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["student_account_created"] is False
        assert data["parent_account_created"] is False

        # FK IDs must not have changed
        db = TestingSessionLocal()
        s1_after = db.query(Student).filter_by(student_id="SMS-2026-001").first()
        assert s1_after.student_user_id == original_student_user_id
        assert s1_after.parent_user_id == original_parent_user_id
        db.close()

    def test_generate_for_nonexistent_student_returns_404(self, client):
        tok = _token(client, "autoadmin@test.com", "admin1234")
        res = client.post(
            "/api/v1/admin/portal/generate/99999",
            headers=_auth(tok),
        )
        assert res.status_code == 404

    def test_teacher_cannot_generate_accounts(self, client):
        db = TestingSessionLocal()
        s1 = db.query(Student).filter_by(student_id="SMS-2026-001").first()
        db.close()
        tok = _token(client, "autoteacher@test.com", "teacher1234")
        res = client.post(
            f"/api/v1/admin/portal/generate/{s1.id}",
            headers=_auth(tok),
        )
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# 3. Bulk generation
# ══════════════════════════════════════════════════════════════════════════════

class TestBulkGenerate:
    @pytest.fixture(autouse=True)
    def reset_s1_links(self):
        """
        Reset SMS-2026-001 back to unlinked state before each test in this class
        so bulk-generate tests start clean.
        """
        db = TestingSessionLocal()
        s1 = db.query(Student).filter_by(student_id="SMS-2026-001").first()
        # Remove generated users from previous tests
        if s1.student_user_id:
            u = db.query(User).filter_by(id=s1.student_user_id).first()
            if u and u.email.startswith("student."):
                db.delete(u)
                s1.student_user_id = None
        if s1.parent_user_id:
            u = db.query(User).filter_by(id=s1.parent_user_id).first()
            if u and u.email.startswith("parent."):
                db.delete(u)
                s1.parent_user_id = None
        db.commit()
        db.close()
        yield

    def test_bulk_creates_accounts_for_unlinked_students(self, client):
        tok = _token(client, "autoadmin@test.com", "admin1234")
        res = client.post(
            "/api/v1/admin/portal/bulk-generate",
            json={"include_students": True, "include_parents": True},
            headers=_auth(tok),
        )
        assert res.status_code == 200
        data = res.json()
        # s1 was unlinked, s2 was already linked
        assert data["student_accounts_created"] == 1
        assert data["parent_accounts_created"] == 1
        assert data["already_linked_students"] == 1
        assert data["already_linked_parents"] == 1
        assert data["errors"] == []

    def test_bulk_generate_idempotent(self, client):
        tok = _token(client, "autoadmin@test.com", "admin1234")
        # First run
        client.post(
            "/api/v1/admin/portal/bulk-generate",
            json={"include_students": True, "include_parents": True},
            headers=_auth(tok),
        )
        # Second run — should create 0 new accounts
        res = client.post(
            "/api/v1/admin/portal/bulk-generate",
            json={"include_students": True, "include_parents": True},
            headers=_auth(tok),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["student_accounts_created"] == 0
        assert data["parent_accounts_created"] == 0
        assert data["already_linked_students"] == 2
        assert data["already_linked_parents"] == 2

    def test_bulk_generate_students_only(self, client):
        tok = _token(client, "autoadmin@test.com", "admin1234")
        res = client.post(
            "/api/v1/admin/portal/bulk-generate",
            json={"include_students": True, "include_parents": False},
            headers=_auth(tok),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["student_accounts_created"] == 1
        assert data["parent_accounts_created"] == 0
        # parent was not requested, should appear as 0 already_linked too
        assert data["already_linked_parents"] == 0

    def test_teacher_cannot_bulk_generate(self, client):
        tok = _token(client, "autoteacher@test.com", "teacher1234")
        res = client.post(
            "/api/v1/admin/portal/bulk-generate",
            json={"include_students": True, "include_parents": True},
            headers=_auth(tok),
        )
        assert res.status_code == 403

    def test_link_status_shows_all_linked_after_bulk(self, client):
        tok = _token(client, "autoadmin@test.com", "admin1234")
        # Generate
        client.post(
            "/api/v1/admin/portal/bulk-generate",
            json={"include_students": True, "include_parents": True},
            headers=_auth(tok),
        )
        # Check status
        res = client.get("/api/v1/admin/portal/link-status", headers=_auth(tok))
        data = res.json()
        assert data["students_without_portal_account"] == 0
        assert data["students_without_parent_account"] == 0
        assert data["unlinked_students"] == []
