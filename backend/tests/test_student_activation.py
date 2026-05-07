from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import verify_password
from app.main import app
from app.models.base_models import (
    AcademicYear,
    Class,
    GenderEnum,
    NotificationOutbox,
    OTPVerification,
    Student,
    StudentActivationRequest,
    StudentStatusEnum,
    User,
)
from app.services import student_activation_service


SQLALCHEMY_TEST_URL = "sqlite:///./test_student_activation.db"

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
    settings.SECRET_KEY = "activation-test-secret-key-that-is-long-enough"
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

    students = [
        Student(
            student_id="SMS-2026-001",
            gr_number="GR001",
            name_en="Alice Smith",
            name_gu="એલિસ",
            dob=date(2014, 8, 15),
            gender=GenderEnum.F,
            class_id=cls.id,
            father_name="Bob Smith",
            contact="9876543210",
            student_email="alice@student.example",
            student_phone="9876543210",
            guardian_email="parent@example.com",
            guardian_phone="9876543211",
            admission_date=date(2026, 6, 1),
            academic_year_id=year.id,
            status=StudentStatusEnum.Active,
        ),
        Student(
            student_id="SMS-2026-002",
            gr_number="GR002",
            name_en="Ben Smith",
            name_gu="બેન",
            dob=date(2015, 5, 20),
            gender=GenderEnum.M,
            class_id=cls.id,
            father_name="Bob Smith",
            contact="9876543212",
            student_email="ben@student.example",
            guardian_email="parent@example.com",
            admission_date=date(2026, 6, 1),
            academic_year_id=year.id,
            status=StudentStatusEnum.Active,
        ),
    ]
    db.add_all(students)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(monkeypatch):
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(student_activation_service, "generate_otp", lambda: "123456")
    if hasattr(app.state, "limiter"):
        app.state.limiter.enabled = False
    with TestClient(app) as c:
        yield c
    if previous_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous_override


def _latest_activation(db, account_type="student"):
    return (
        db.query(StudentActivationRequest)
        .filter_by(account_type=account_type)
        .order_by(StudentActivationRequest.id.desc())
        .first()
    )


def test_start_activation_is_generic_and_hashes_otp(client):
    valid = client.post(
        "/api/v1/student-auth/start-activation",
        json={"identifier": "SMS-2026-001", "email": "alice@student.example", "account_type": "student"},
    )
    invalid = client.post(
        "/api/v1/student-auth/start-activation",
        json={"identifier": "SMS-2026-001", "email": "wrong@student.example", "account_type": "student"},
    )

    assert valid.status_code == 200
    assert invalid.status_code == 200
    assert valid.json()["message"] == invalid.json()["message"]

    db = TestingSessionLocal()
    activation = _latest_activation(db, "student")
    otp = db.query(OTPVerification).filter_by(activation_request_id=activation.id).first()
    outbox = db.query(NotificationOutbox).filter_by(provider="email").first()
    assert activation.destination == "alice@student.example"
    assert otp.otp_hash != "123456"
    assert outbox.destination == "alice@student.example"
    assert db.query(StudentActivationRequest).count() == 1
    db.close()


def test_start_activation_matches_identifier_and_email_case_insensitively(client):
    res = client.post(
        "/api/v1/student-auth/start-activation",
        json={"identifier": " sms-2026-001 ", "email": " ALICE@STUDENT.EXAMPLE ", "account_type": "student"},
    )

    assert res.status_code == 200
    db = TestingSessionLocal()
    activation = _latest_activation(db, "student")
    outbox = db.query(NotificationOutbox).filter_by(provider="email").order_by(NotificationOutbox.id.desc()).first()
    assert activation is not None
    assert activation.destination == "alice@student.example"
    assert outbox.destination == "alice@student.example"
    db.close()


def test_student_activation_completes_and_cannot_be_reused(client):
    db = TestingSessionLocal()
    activation = _latest_activation(db, "student")
    activation_id = activation.activation_id
    db.close()

    verify = client.post(
        "/api/v1/student-auth/verify-otp",
        json={"activation_id": activation_id, "otp": "123456"},
    )
    assert verify.status_code == 200
    token = verify.json()["activation_token"]

    complete = client.post(
        "/api/v1/student-auth/complete-registration",
        json={"activation_token": token, "password": "studentpass1"},
    )
    assert complete.status_code == 200
    assert complete.json()["role"] == "student"
    assert complete.json()["linked_student_id"] is not None

    reused = client.post(
        "/api/v1/student-auth/complete-registration",
        json={"activation_token": token, "password": "studentpass1"},
    )
    assert reused.status_code == 400

    db = TestingSessionLocal()
    student = db.query(Student).filter_by(student_id="SMS-2026-001").first()
    user = db.query(User).filter_by(id=student.student_user_id).first()
    assert user.email == "alice@student.example"
    assert verify_password("studentpass1", user.password_hash)
    db.close()


def test_parent_activation_reuses_one_account_for_siblings(client):
    first = client.post(
        "/api/v1/student-auth/start-activation",
        json={"identifier": "GR001", "email": "parent@example.com", "account_type": "parent"},
    )
    assert first.status_code == 200
    verify_first = client.post(
        "/api/v1/student-auth/verify-otp",
        json={"activation_id": first.json()["activation_id"], "otp": "123456"},
    )
    assert verify_first.status_code == 200
    complete_first = client.post(
        "/api/v1/student-auth/complete-registration",
        json={"activation_token": verify_first.json()["activation_token"], "password": "parentpass1"},
    )
    assert complete_first.status_code == 200
    first_user_id = complete_first.json()["user_id"]

    second = client.post(
        "/api/v1/student-auth/start-activation",
        json={"identifier": "GR002", "email": "parent@example.com", "account_type": "parent"},
    )
    assert second.status_code == 200
    verify_second = client.post(
        "/api/v1/student-auth/verify-otp",
        json={"activation_id": second.json()["activation_id"], "otp": "123456"},
    )
    assert verify_second.status_code == 200
    complete_second = client.post(
        "/api/v1/student-auth/complete-registration",
        json={"activation_token": verify_second.json()["activation_token"], "password": "anotherpass1"},
    )
    assert complete_second.status_code == 200
    assert complete_second.json()["user_id"] == first_user_id
    assert sorted(complete_second.json()["linked_student_ids"]) == sorted(complete_first.json()["linked_student_ids"] + [2])

    db = TestingSessionLocal()
    s1 = db.query(Student).filter_by(student_id="SMS-2026-001").first()
    s2 = db.query(Student).filter_by(student_id="SMS-2026-002").first()
    assert s1.parent_user_id == s2.parent_user_id == first_user_id
    db.close()
