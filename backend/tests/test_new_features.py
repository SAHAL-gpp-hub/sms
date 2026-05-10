from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.routers.auth as auth_router
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.base_models import (
    AcademicYear,
    Class,
    DataAuditLog,
    GenderEnum,
    Student,
    StudentStatusEnum,
    User,
)


SQLALCHEMY_TEST_URL = "sqlite:///./test_new_features.db"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    previous_get_db_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    year = AcademicYear(label="2025-26", start_date=date(2025, 6, 1), end_date=date(2026, 3, 31), is_current=True)
    db.add(year)
    db.flush()
    cls = Class(name="5", division="A", academic_year_id=year.id)
    db.add(cls)
    db.flush()
    admin_user = User(
        name="Admin",
        email="admin-new@test.com",
        password_hash=get_password_hash("admin1234"),
        role="admin",
        is_active=True,
    )
    db.add(admin_user)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    if previous_get_db_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous_get_db_override


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def login(client: TestClient) -> dict:
    res = client.post("/api/v1/auth/login", data={"username": "admin-new@test.com", "password": "admin1234"})
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload.get("requires_2fa") is False
    return {"Authorization": f"Bearer {payload['access_token']}"}


def test_student_list_pagination_contract(client: TestClient):
    db = TestingSessionLocal()
    cls = db.query(Class).first()
    year = db.query(AcademicYear).first()
    for i in range(55):
        db.add(
            Student(
                student_id=f"SMS-2025-{1000 + i}",
                name_en=f"Student {i}",
                name_gu=f"વિદ્યાર્થી {i}",
                dob=date(2015, 1, 1),
                gender=GenderEnum.M,
                class_id=cls.id,
                father_name="Father",
                contact=f"900000{str(i).zfill(4)}"[-10:],
                admission_date=date(2025, 6, 1),
                academic_year_id=year.id,
                status=StudentStatusEnum.Active,
            )
        )
    db.commit()
    db.close()

    res = client.get("/api/v1/students/?limit=50&offset=0", headers=login(client))
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["limit"] == 50
    assert data["offset"] == 0
    assert data["total"] >= 55
    assert len(data["items"]) == 50


def test_student_crud_writes_audit_logs(client: TestClient):
    headers = login(client)
    db = TestingSessionLocal()
    cls = db.query(Class).first()
    year = db.query(AcademicYear).first()
    db.close()
    create_payload = {
        "name_en": "Audit Student",
        "name_gu": "ઓડિટ વિદ્યાર્થી",
        "dob": "2014-01-01",
        "gender": "M",
        "class_id": cls.id,
        "father_name": "Audit Father",
        "contact": "9876543210",
        "admission_date": "2025-06-01",
        "academic_year_id": year.id,
    }
    create_res = client.post("/api/v1/students/", json=create_payload, headers=headers)
    assert create_res.status_code == 201, create_res.text
    sid = create_res.json()["id"]
    update_res = client.put(f"/api/v1/students/{sid}", json={"father_name": "Audit Father Updated"}, headers=headers)
    assert update_res.status_code == 200, update_res.text
    delete_res = client.delete(f"/api/v1/students/{sid}", headers=headers)
    assert delete_res.status_code == 200, delete_res.text

    db = TestingSessionLocal()
    logs = db.query(DataAuditLog).filter(DataAuditLog.table_name == "students", DataAuditLog.record_id == str(sid)).all()
    db.close()
    actions = {log.action.value if hasattr(log.action, "value") else str(log.action) for log in logs}
    assert {"create", "update", "delete"}.issubset(actions)


def test_admin_login_2fa_challenge_and_verify(client: TestClient, monkeypatch):
    db = TestingSessionLocal()
    admin = db.query(User).filter_by(email="admin-new@test.com").first()
    admin.two_factor_enabled = True
    admin.two_factor_channel = "sms"
    admin.two_factor_destination = "9876543210"
    db.commit()
    db.close()

    monkeypatch.setattr(auth_router.secrets, "randbelow", lambda _: 123456)
    login_res = client.post("/api/v1/auth/login", data={"username": "admin-new@test.com", "password": "admin1234"})
    assert login_res.status_code == 200, login_res.text
    payload = login_res.json()
    assert payload["requires_2fa"] is True
    assert payload["challenge_id"]

    verify_res = client.post("/api/v1/auth/verify-2fa", json={"challenge_id": payload["challenge_id"], "otp": "123456"})
    assert verify_res.status_code == 200, verify_res.text
    assert verify_res.json()["access_token"]

