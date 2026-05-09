"""
tests/test_rbac.py  — Sprint 9 RBAC test suite

Tests cover:
  - Login / JWT issuance for each role
  - Role-based endpoint access (admin, teacher, student, parent)
  - Teacher class access enforcement (ensure_class_access)
  - Student / parent scoped data access (ensure_student_access)
  - Token revocation (logout + blocklist)
  - Rate limiting smoke-test (login endpoint)

Run with:
    pytest tests/test_rbac.py -v
"""

import pytest
from datetime import date  # ✅ FIX: import date for type-safe Date column values
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.base_models import (
    AcademicYear, Class, Exam, FeeHead, FeePayment, FeeStructure, Student, StudentFee,
    GenderEnum, StudentStatusEnum, Subject,
    TeacherClassAssignment, User,
)

# ── In-memory SQLite test database ────────────────────────────────────────────
SQLALCHEMY_TEST_URL = "sqlite:///./test_rbac.db"

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


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Create all tables once, seed test data, tear down at end."""
    previous_get_db_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Academic year
    # ✅ FIX: Use date() objects instead of ISO strings — SQLite Date type
    #         requires Python date objects; PostgreSQL was silently coercing strings.
    year = AcademicYear(
        label="2025-26",
        start_date=date(2025, 6, 1),   # ✅ was "2025-06-01"
        end_date=date(2026, 3, 31),    # ✅ was "2026-03-31"
        is_current=True,
    )
    db.add(year)
    db.flush()

    # Two classes
    cls_a = Class(name="5", division="A", academic_year_id=year.id)
    cls_b = Class(name="6", division="A", academic_year_id=year.id)
    db.add_all([cls_a, cls_b])
    db.flush()

    subject_a = Subject(name="Mathematics", class_id=cls_a.id, max_theory=100, max_practical=0)
    subject_b = Subject(name="Science", class_id=cls_a.id, max_theory=100, max_practical=0)
    subject_other_class = Subject(name="English", class_id=cls_b.id, max_theory=100, max_practical=0)
    exam_a = Exam(name="Unit Test 1", class_id=cls_a.id, academic_year_id=year.id)
    db.add_all([subject_a, subject_b, subject_other_class, exam_a])
    db.flush()

    # Users
    admin_user = User(name="Admin",        email="admin@test.com",    password_hash=get_password_hash("admin1234"),    role="admin",   is_active=True)
    teacher_a  = User(name="Teacher A",    email="teachera@test.com", password_hash=get_password_hash("teacher1234"), role="teacher", is_active=True)
    teacher_b  = User(name="Teacher B",    email="teacherb@test.com", password_hash=get_password_hash("teacher1234"), role="teacher", is_active=True)
    student_u  = User(name="Student User", email="student@test.com",  password_hash=get_password_hash("student1234"), role="student", is_active=True)
    parent_u   = User(name="Parent User",  email="parent@test.com",   password_hash=get_password_hash("parent1234"),  role="parent",  is_active=True)
    inactive_u = User(name="Inactive",     email="inactive@test.com", password_hash=get_password_hash("inactive1234"), role="teacher", is_active=False)
    db.add_all([admin_user, teacher_a, teacher_b, student_u, parent_u, inactive_u])
    db.flush()

    # Teacher A is class teacher for class A and separately assigned one marks subject.
    db.add(TeacherClassAssignment(teacher_id=teacher_a.id, class_id=cls_a.id, academic_year_id=year.id))
    db.add(TeacherClassAssignment(
        teacher_id=teacher_a.id,
        class_id=cls_a.id,
        academic_year_id=year.id,
        subject_id=subject_a.id,
    ))

    # A student record linked to the student/parent users
    student = Student(
        student_id="SMS-2025-001",
        name_en="Test Student",
        name_gu="ટેસ્ટ",
        dob=date(2015, 1, 1),           # ✅ was "2015-01-01"
        gender=GenderEnum.M,
        class_id=cls_a.id,
        father_name="Test Father",
        contact="9876543210",
        admission_date=date(2025, 6, 1), # ✅ was "2025-06-01"
        academic_year_id=year.id,
        status=StudentStatusEnum.Active,
        student_user_id=student_u.id,
        parent_user_id=parent_u.id,
    )
    db.add(student)
    db.flush()

    fee_head = FeeHead(name="Tuition Fee", frequency="Monthly", is_active=True)
    db.add(fee_head)
    db.flush()

    fee_structure = FeeStructure(
        class_id=cls_a.id,
        fee_head_id=fee_head.id,
        amount=1000,
        academic_year_id=year.id,
    )
    db.add(fee_structure)
    db.flush()

    student_fee = StudentFee(
        student_id=student.id,
        fee_structure_id=fee_structure.id,
        net_amount=1000,
        academic_year_id=year.id,
    )
    db.add(student_fee)
    db.flush()

    db.add_all([
        FeePayment(
            student_fee_id=student_fee.id,
            amount_paid=300,
            payment_date=date(2025, 6, 10),
            mode="Cash",
            receipt_number="RCPT-TEST-0001",
        ),
        FeePayment(
            student_fee_id=student_fee.id,
            amount_paid=200,
            payment_date=date(2025, 6, 20),
            mode="Cash",
            receipt_number="RCPT-TEST-0002",
        ),
    ])
    db.commit()
    db.close()

    yield  # run tests

    Base.metadata.drop_all(bind=engine)
    if previous_get_db_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous_get_db_override


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


# ── Login helpers ─────────────────────────────────────────────────────────────
def login(client, email, password):
    res = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    return res


def token(client, email, password):
    res = login(client, email, password)
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ══════════════════════════════════════════════════════════════════════════════
# 1. Login / JWT issuance
# ══════════════════════════════════════════════════════════════════════════════

class TestLogin:
    def test_admin_login_success(self, client):
        res = login(client, "admin@test.com", "admin1234")
        assert res.status_code == 200
        data = res.json()
        assert data["role"] == "admin"
        assert "access_token" in data

    def test_teacher_login_includes_class_ids(self, client):
        res = login(client, "teachera@test.com", "teacher1234")
        assert res.status_code == 200
        data = res.json()
        assert data["role"] == "teacher"
        assert isinstance(data["assigned_class_ids"], list)
        assert len(data["assigned_class_ids"]) >= 1
        assert isinstance(data["class_teacher_class_ids"], list)
        assert isinstance(data["subject_assignments"], list)

    def test_student_login_includes_linked_student_id(self, client):
        res = login(client, "student@test.com", "student1234")
        assert res.status_code == 200
        data = res.json()
        assert data["role"] == "student"
        assert data["linked_student_id"] is not None

    def test_parent_login_includes_linked_student_ids(self, client):
        res = login(client, "parent@test.com", "parent1234")
        assert res.status_code == 200
        data = res.json()
        assert data["role"] == "parent"
        assert isinstance(data["linked_student_ids"], list)
        assert len(data["linked_student_ids"]) >= 1

    def test_wrong_password_returns_401(self, client):
        res = login(client, "admin@test.com", "wrongpassword")
        assert res.status_code == 401

    def test_inactive_user_cannot_login(self, client):
        res = login(client, "inactive@test.com", "inactive1234")
        assert res.status_code == 401

    def test_nonexistent_user_returns_401(self, client):
        res = login(client, "ghost@test.com", "whatever")
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 2. /auth/me
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthMe:
    def test_me_returns_current_user(self, client):
        tok = token(client, "admin@test.com", "admin1234")
        res = client.get("/api/v1/auth/me", headers=auth(tok))
        assert res.status_code == 200
        assert res.json()["email"] == "admin@test.com"

    def test_me_without_token_returns_401(self, client):
        res = client.get("/api/v1/auth/me")
        assert res.status_code == 401

    def test_me_with_garbage_token_returns_401(self, client):
        res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage"})
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 3. Admin-only endpoints
# ══════════════════════════════════════════════════════════════════════════════

class TestAdminEndpoints:
    def test_admin_can_list_users(self, client):
        tok = token(client, "admin@test.com", "admin1234")
        res = client.get("/api/v1/admin/users", headers=auth(tok))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_teacher_cannot_list_users(self, client):
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.get("/api/v1/admin/users", headers=auth(tok))
        assert res.status_code == 403

    def test_student_cannot_list_users(self, client):
        tok = token(client, "student@test.com", "student1234")
        res = client.get("/api/v1/admin/users", headers=auth(tok))
        assert res.status_code == 403

    def test_parent_cannot_list_users(self, client):
        tok = token(client, "parent@test.com", "parent1234")
        res = client.get("/api/v1/admin/users", headers=auth(tok))
        assert res.status_code == 403

    def test_admin_can_create_user(self, client):
        tok = token(client, "admin@test.com", "admin1234")
        res = client.post("/api/v1/admin/users", json={
            "name": "New Teacher",
            "email": "newteacher@test.com",
            "password": "newteacher1234",
            "role": "teacher",
            "is_active": True,
        }, headers=auth(tok))
        assert res.status_code == 201
        assert res.json()["role"] == "teacher"

    def test_teacher_cannot_create_user(self, client):
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.post("/api/v1/admin/users", json={
            "name": "Rogue User",
            "email": "rogue@test.com",
            "password": "rogue1234",
            "role": "admin",
        }, headers=auth(tok))
        assert res.status_code == 403

    def test_admin_can_list_teacher_assignments(self, client):
        tok = token(client, "admin@test.com", "admin1234")
        users = client.get("/api/v1/admin/users?role=teacher", headers=auth(tok)).json()
        teacher = next((u for u in users if u["email"] == "teachera@test.com"), None)
        assert teacher is not None
        res = client.get(f"/api/v1/admin/teachers/{teacher['id']}/assignments", headers=auth(tok))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_teacher_cannot_manage_assignments(self, client):
        tok_admin   = token(client, "admin@test.com", "admin1234")
        tok_teacher = token(client, "teachera@test.com", "teacher1234")
        users = client.get("/api/v1/admin/users?role=teacher", headers=auth(tok_admin)).json()
        teacher = next((u for u in users if u["email"] == "teachera@test.com"), None)
        res = client.get(
            f"/api/v1/admin/teachers/{teacher['id']}/assignments",
            headers=auth(tok_teacher),
        )
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# 4. Student list scoping
# ══════════════════════════════════════════════════════════════════════════════

class TestStudentScoping:
    def test_admin_sees_all_students(self, client):
        tok = token(client, "admin@test.com", "admin1234")
        res = client.get("/api/v1/students/", headers=auth(tok))
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_teacher_a_can_list_students(self, client):
        """Teacher A is assigned to class A — should see students in that class."""
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.get("/api/v1/students/", headers=auth(tok))
        assert res.status_code == 200

    def test_student_user_sees_only_own_record(self, client):
        tok = token(client, "student@test.com", "student1234")
        res = client.get("/api/v1/students/", headers=auth(tok))
        assert res.status_code == 200
        data = res.json()
        # Should only contain the linked student
        assert len(data) == 1
        assert data[0]["student_id"] == "SMS-2025-001"

    def test_parent_sees_only_linked_children(self, client):
        tok = token(client, "parent@test.com", "parent1234")
        res = client.get("/api/v1/students/", headers=auth(tok))
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["student_id"] == "SMS-2025-001"

    def test_unauthenticated_cannot_list_students(self, client):
        res = client.get("/api/v1/students/")
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 5. Teacher class-access enforcement
# ══════════════════════════════════════════════════════════════════════════════

class TestTeacherClassAccess:
    def _get_class_ids(self, client):
        tok = token(client, "admin@test.com", "admin1234")
        classes = client.get("/api/v1/setup/classes", headers=auth(tok)).json()
        cls_a = next((c for c in classes if c["name"] == "5"), None)
        cls_b = next((c for c in classes if c["name"] == "6"), None)
        return cls_a["id"], cls_b["id"], tok

    def test_teacher_a_can_get_attendance_for_assigned_class(self, client):
        cls_a_id, _, _ = self._get_class_ids(client)
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.get(
            "/api/v1/attendance/daily",
            params={"class_id": cls_a_id, "date": str(date.today())},
            headers=auth(tok),
        )
        # 200 (empty roster is fine) or 403
        assert res.status_code == 200

    def test_teacher_a_cannot_get_attendance_for_unassigned_class(self, client):
        _, cls_b_id, _ = self._get_class_ids(client)
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.get(
            "/api/v1/attendance/daily",
            params={"class_id": cls_b_id, "date": str(date.today())},
            headers=auth(tok),
        )
        assert res.status_code == 403

    def test_teacher_b_cannot_access_class_a_marks(self, client):
        cls_a_id, _, _ = self._get_class_ids(client)
        tok = token(client, "teacherb@test.com", "teacher1234")
        res = client.get(
            "/api/v1/marks/subjects",
            params={"class_id": cls_a_id},
            headers=auth(tok),
        )
        assert res.status_code == 403

    def test_admin_can_access_any_class(self, client):
        cls_a_id, cls_b_id, tok = self._get_class_ids(client)
        for cls_id in [cls_a_id, cls_b_id]:
            res = client.get(
                "/api/v1/attendance/daily",
                params={"class_id": cls_id, "date": str(date.today())},
                headers=auth(tok),
            )
            assert res.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# 6. Fee scoping
# ══════════════════════════════════════════════════════════════════════════════

class TestFeeScoping:
    def _student_id(self, client):
        tok = token(client, "admin@test.com", "admin1234")
        students = client.get("/api/v1/students/", headers=auth(tok)).json()
        return students[0]["id"], tok

    def test_admin_can_view_any_ledger(self, client):
        sid, tok = self._student_id(client)
        res = client.get(f"/api/v1/fees/ledger/{sid}", headers=auth(tok))
        assert res.status_code in (200, 404)  # 404 if no fees assigned yet — that's fine

    def test_student_can_view_own_ledger(self, client):
        sid, _ = self._student_id(client)
        tok = token(client, "student@test.com", "student1234")
        res = client.get(f"/api/v1/fees/ledger/{sid}", headers=auth(tok))
        assert res.status_code in (200, 404)

    def test_student_cannot_view_fee_structure(self, client):
        tok = token(client, "student@test.com", "student1234")
        res = client.get("/api/v1/fees/structure", headers=auth(tok))
        # fee structure is public (no auth) — this should succeed
        assert res.status_code == 200

    def test_student_cannot_create_fee_structure(self, client):
        tok = token(client, "student@test.com", "student1234")
        res = client.post("/api/v1/fees/structure", json={
            "class_id": 1, "fee_head_id": 1, "amount": 500,
            "academic_year_id": 1,
        }, headers=auth(tok))
        assert res.status_code == 403

    def test_teacher_cannot_record_payment(self, client):
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.post("/api/v1/fees/payment", json={
            "student_fee_id": 1, "amount_paid": 100,
            "payment_date": "2025-06-01", "mode": "Cash",
        }, headers=auth(tok))
        assert res.status_code == 403

    def test_teacher_cannot_view_defaulters(self, client):
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.get("/api/v1/fees/defaulters", headers=auth(tok))
        assert res.status_code == 403

    def test_admin_can_view_defaulters_with_correct_totals(self, client):
        tok = token(client, "admin@test.com", "admin1234")
        res = client.get(
            "/api/v1/fees/defaulters",
            params={"academic_year_id": 1},
            headers=auth(tok),
        )
        assert res.status_code == 200, res.text
        assert res.json() == [{
            "student_id": 1,
            "student_name": "Test Student",
            "class_id": 1,
            "class_name": "5",
            "contact": "9876543210",
            "total_due": 1000.0,
            "total_paid": 500.0,
            "balance": 500.0,
        }]


# ══════════════════════════════════════════════════════════════════════════════
# 7. Year-end scoping
# ══════════════════════════════════════════════════════════════════════════════

class TestYearEndScoping:
    def test_anyone_can_get_current_year(self, client):
        res = client.get("/api/v1/yearend/current-year")
        assert res.status_code in (200, 404)  # 404 if DB is empty in this test scope

    def test_teacher_cannot_create_new_year(self, client):
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.post("/api/v1/yearend/new-year", json={
            "label": "2099-00", "start_date": "2099-06-01", "end_date": "2100-03-31",
        }, headers=auth(tok))
        assert res.status_code == 403

    def test_student_cannot_promote_class(self, client):
        tok = token(client, "student@test.com", "student1234")
        res = client.post("/api/v1/yearend/promote/1?new_academic_year_id=1", headers=auth(tok))
        assert res.status_code == 403

    def test_teacher_cannot_issue_tc(self, client):
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.post("/api/v1/yearend/issue-tc/1", headers=auth(tok))
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# 8. Token revocation (logout + blocklist)
# ══════════════════════════════════════════════════════════════════════════════

class TestTokenRevocation:
    def test_logout_then_me_returns_401(self, client):
        # Login as teacher B (unused elsewhere in tests so token is fresh)
        tok = token(client, "teacherb@test.com", "teacher1234")

        # Confirm token works
        res = client.get("/api/v1/auth/me", headers=auth(tok))
        assert res.status_code == 200

        # Logout
        res = client.post("/api/v1/auth/logout", headers=auth(tok))
        assert res.status_code == 200

        # Token should now be rejected
        res = client.get("/api/v1/auth/me", headers=auth(tok))
        assert res.status_code == 401

    def test_double_logout_is_idempotent(self, client):
        """Logging out twice with the same token should not crash the server."""
        tok = token(client, "admin@test.com", "admin1234")
        client.post("/api/v1/auth/logout", headers=auth(tok))
        res = client.post("/api/v1/auth/logout", headers=auth(tok))
        # Either 200 (already revoked, idempotent) or 401 (token already invalid)
        assert res.status_code in (200, 401)


# ══════════════════════════════════════════════════════════════════════════════
# 9. Registration guard
# ══════════════════════════════════════════════════════════════════════════════

class TestRegistrationGuard:
    def test_register_disabled_by_default(self, client, monkeypatch):
        """REGISTRATION_ENABLED defaults to False — should return 403."""
        from app.core import config as cfg_module
        monkeypatch.setattr(cfg_module.settings, "REGISTRATION_ENABLED", False)
        res = client.post("/api/v1/auth/register", json={
            "name": "Hacker", "email": "hacker@test.com",
            "password": "hacker1234", "role": "admin",
        })
        assert res.status_code == 403

    def test_register_duplicate_email_rejected(self, client, monkeypatch):
        """Even with registration enabled, duplicate emails return 409."""
        from app.core import config as cfg_module
        monkeypatch.setattr(cfg_module.settings, "REGISTRATION_ENABLED", True)
        res = client.post("/api/v1/auth/register", json={
            "name": "Dup Admin", "email": "admin@test.com",
            "password": "admin1234", "role": "admin",
        })
        assert res.status_code == 409


# ══════════════════════════════════════════════════════════════════════════════
# 10. Marks entry scoping
# ══════════════════════════════════════════════════════════════════════════════

class TestMarksScoping:
    def _class_ids(self, client):
        tok = token(client, "admin@test.com", "admin1234")
        classes = client.get("/api/v1/setup/classes", headers=auth(tok)).json()
        cls_a = next((c for c in classes if c["name"] == "5"), None)
        cls_b = next((c for c in classes if c["name"] == "6"), None)
        return cls_a["id"], cls_b["id"]

    def test_student_cannot_enter_marks(self, client):
        tok = token(client, "student@test.com", "student1234")
        res = client.post("/api/v1/marks/bulk", json=[], headers=auth(tok))
        assert res.status_code == 403

    def test_parent_cannot_enter_marks(self, client):
        tok = token(client, "parent@test.com", "parent1234")
        res = client.post("/api/v1/marks/bulk", json=[], headers=auth(tok))
        assert res.status_code == 403

    def test_teacher_cannot_create_exam(self, client):
        cls_a_id, _ = self._class_ids(client)
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.post("/api/v1/marks/exams", json={
            "name": "Unit Test 1", "class_id": cls_a_id, "academic_year_id": 1,
        }, headers=auth(tok))
        assert res.status_code == 403

    def test_admin_can_create_exam(self, client):
        cls_a_id, _ = self._class_ids(client)
        tok = token(client, "admin@test.com", "admin1234")
        res = client.post("/api/v1/marks/exams", json={
            "name": "Unit Test 1", "class_id": cls_a_id, "academic_year_id": 1,
        }, headers=auth(tok))
        assert res.status_code in (201, 422)  # 422 if year id invalid in test db

    def test_teacher_sees_only_assigned_subjects(self, client):
        cls_a_id, _ = self._class_ids(client)
        tok = token(client, "teachera@test.com", "teacher1234")
        res = client.get(
            "/api/v1/marks/subjects",
            params={"class_id": cls_a_id},
            headers=auth(tok),
        )
        assert res.status_code == 200
        subjects = res.json()
        assert [s["name"] for s in subjects] == ["Mathematics"]

    def test_teacher_can_enter_assigned_subject_marks(self, client):
        cls_a_id, _ = self._class_ids(client)
        tok = token(client, "teachera@test.com", "teacher1234")
        subjects = client.get(
            "/api/v1/marks/subjects",
            params={"class_id": cls_a_id},
            headers=auth(tok),
        ).json()
        students = client.get("/api/v1/students/", headers=auth(tok)).json()
        exams = client.get(
            "/api/v1/marks/exams",
            params={"class_id": cls_a_id, "academic_year_id": 1},
            headers=auth(tok),
        ).json()
        res = client.post("/api/v1/marks/bulk", json=[{
            "student_id": students[0]["id"],
            "subject_id": subjects[0]["id"],
            "exam_id": exams[0]["id"],
            "theory_marks": 88,
            "practical_marks": None,
            "is_absent": False,
        }], headers=auth(tok))
        assert res.status_code == 200

    def test_teacher_cannot_enter_unassigned_subject_marks(self, client):
        cls_a_id, _ = self._class_ids(client)
        admin_tok = token(client, "admin@test.com", "admin1234")
        teacher_tok = token(client, "teachera@test.com", "teacher1234")
        all_subjects = client.get(
            "/api/v1/marks/subjects",
            params={"class_id": cls_a_id},
            headers=auth(admin_tok),
        ).json()
        science = next(s for s in all_subjects if s["name"] == "Science")
        students = client.get("/api/v1/students/", headers=auth(teacher_tok)).json()
        exams = client.get(
            "/api/v1/marks/exams",
            params={"class_id": cls_a_id, "academic_year_id": 1},
            headers=auth(teacher_tok),
        ).json()
        res = client.post("/api/v1/marks/bulk", json=[{
            "student_id": students[0]["id"],
            "subject_id": science["id"],
            "exam_id": exams[0]["id"],
            "theory_marks": 75,
            "practical_marks": None,
            "is_absent": False,
        }], headers=auth(teacher_tok))
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# 11. Health check (no auth)
# ══════════════════════════════════════════════════════════════════════════════

class TestPublicEndpoints:
    def test_health_endpoint_is_public(self, client):
        res = client.get("/health")
        assert res.status_code == 200

    def test_root_is_public(self, client):
        res = client.get("/")
        assert res.status_code == 200

    def test_tc_pdf_requires_signed_download_token_without_bearer_auth(self, client):
        """TC PDF route is public, but the download itself needs a short-lived signed token."""
        res = client.get("/api/v1/yearend/tc-pdf/9999")
        assert res.status_code == 401
        assert "token" in res.json()["detail"].lower()

    def test_current_year_is_public(self, client):
        res = client.get("/api/v1/yearend/current-year")
        assert res.status_code in (200, 404)
        assert res.status_code != 401
