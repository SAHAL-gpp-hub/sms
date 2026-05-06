from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.base_models import (
    AcademicYear,
    Class,
    GenderEnum,
    NotificationOutbox,
    Student,
    StudentStatusEnum,
    User,
)
from app.services import student_activation_service


SQLALCHEMY_TEST_URL = "sqlite:///./test_portal_activation_admin.db"

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
    settings.SECRET_KEY = "portal-admin-test-secret-key-that-is-long-enough"
    settings.NOTIFICATION_WORKER_ENABLED = False
    Base.metadata.drop_all(bind=engine)
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

    admin = User(
        name="Admin",
        email="activation-admin@example.com",
        password_hash=get_password_hash("admin1234"),
        role="admin",
        is_active=True,
    )
    teacher = User(
        name="Teacher",
        email="activation-teacher@example.com",
        password_hash=get_password_hash("teacher1234"),
        role="teacher",
        is_active=True,
    )
    db.add_all([admin, teacher])
    db.flush()

    student = Student(
        student_id="SMS-2026-010",
        gr_number="GR010",
        name_en="Nina Patel",
        name_gu="નીના",
        dob=date(2014, 8, 15),
        gender=GenderEnum.F,
        class_id=cls.id,
        father_name="Raj Patel",
        contact="9876543210",
        student_email="nina@example.com",
        guardian_email="raj@example.com",
        admission_date=date(2026, 6, 1),
        academic_year_id=year.id,
        status=StudentStatusEnum.Active,
    )
    db.add(student)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def client():
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    if previous_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous_override


@pytest.fixture(autouse=True)
def disable_rate_limit(monkeypatch):
    monkeypatch.setattr(student_activation_service, "generate_otp", lambda: "123456")
    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = False


def _token(client, email, password):
    res = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_link_status_includes_activation_readiness(client):
    token = _token(client, "activation-admin@example.com", "admin1234")
    res = client.get("/api/v1/admin/portal/link-status", headers=_auth(token))
    assert res.status_code == 200
    data = res.json()
    assert data["students_without_portal_account"] == 1
    assert data["students_without_parent_account"] == 1
    item = data["unlinked_students"][0]
    assert item["has_student_email"] is True
    assert item["has_guardian_email"] is True


def test_old_generation_endpoints_are_gone(client):
    token = _token(client, "activation-admin@example.com", "admin1234")
    bulk = client.post(
        "/api/v1/admin/portal/bulk-generate",
        json={"include_students": True, "include_parents": True},
        headers=_auth(token),
    )
    single = client.post("/api/v1/admin/portal/generate/1", headers=_auth(token))
    assert bulk.status_code == 410
    assert single.status_code == 410


def test_admin_can_queue_activation_email(client):
    token = _token(client, "activation-admin@example.com", "admin1234")
    res = client.post(
        "/api/v1/admin/portal/resend-activation/1",
        json={"account_type": "student"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    db = TestingSessionLocal()
    outbox = db.query(NotificationOutbox).filter_by(destination="nina@example.com").first()
    assert outbox is not None
    assert outbox.status == "pending"
    db.close()


def test_teacher_cannot_queue_activation_email(client):
    token = _token(client, "activation-teacher@example.com", "teacher1234")
    res = client.post(
        "/api/v1/admin/portal/resend-activation/1",
        json={"account_type": "student"},
        headers=_auth(token),
    )
    assert res.status_code == 403
