import hashlib
import hmac
import json
from datetime import date
from decimal import Decimal

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
    FeeHead,
    FeePayment,
    FeeStructure,
    GenderEnum,
    OnlinePaymentOrder,
    Student,
    StudentFee,
    StudentStatusEnum,
    User,
)


SQLALCHEMY_TEST_URL = "sqlite:///./test_online_payments.db"

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


def _signature(order_id: str, payment_id: str) -> str:
    return hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()


def _webhook_signature(body: bytes) -> str:
    return hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()


def _webhook_body(order_id: str, payment_id: str, amount: int, currency: str = "INR", status: str = "captured"):
    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": payment_id,
                    "order_id": order_id,
                    "amount": amount,
                    "currency": currency,
                    "status": status,
                }
            }
        },
    }
    return json.dumps(payload, separators=(",", ":")).encode()


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    settings.RAZORPAY_KEY_ID = "rzp_test_unit"
    settings.RAZORPAY_KEY_SECRET = "unit_test_razorpay_secret"
    settings.RAZORPAY_WEBHOOK_SECRET = "unit_test_webhook_secret"

    previous_get_db_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    year = AcademicYear(
        label="2025-26",
        start_date=date(2025, 6, 1),
        end_date=date(2026, 3, 31),
        is_current=True,
    )
    db.add(year)
    db.flush()

    cls = Class(name="5", division="A", academic_year_id=year.id)
    db.add(cls)
    db.flush()

    parent = User(
        name="Parent",
        email="parentpay@test.com",
        password_hash=get_password_hash("parent1234"),
        role="parent",
        is_active=True,
    )
    other_parent = User(
        name="Other Parent",
        email="otherparentpay@test.com",
        password_hash=get_password_hash("parent1234"),
        role="parent",
        is_active=True,
    )
    db.add_all([parent, other_parent])
    db.flush()

    student = Student(
        student_id="SMS-2025-501",
        name_en="Payment Student",
        name_gu="પેમેન્ટ",
        dob=date(2015, 1, 1),
        gender=GenderEnum.M,
        class_id=cls.id,
        father_name="Payment Father",
        contact="9876543210",
        guardian_email="guardian@example.com",
        admission_date=date(2025, 6, 1),
        academic_year_id=year.id,
        status=StudentStatusEnum.Active,
        parent_user_id=parent.id,
    )
    other_student = Student(
        student_id="SMS-2025-502",
        name_en="Other Student",
        name_gu="અન્ય",
        dob=date(2015, 1, 1),
        gender=GenderEnum.F,
        class_id=cls.id,
        father_name="Other Father",
        contact="9876543211",
        admission_date=date(2025, 6, 1),
        academic_year_id=year.id,
        status=StudentStatusEnum.Active,
        parent_user_id=other_parent.id,
    )
    db.add_all([student, other_student])
    db.flush()

    head = FeeHead(name="Tuition Fee", frequency="Monthly", is_active=True)
    db.add(head)
    db.flush()
    structure = FeeStructure(
        class_id=cls.id,
        fee_head_id=head.id,
        amount=Decimal("1200.00"),
        academic_year_id=year.id,
    )
    db.add(structure)
    db.flush()

    fee = StudentFee(
        student_id=student.id,
        fee_structure_id=structure.id,
        concession=Decimal("0.00"),
        net_amount=Decimal("1200.00"),
        academic_year_id=year.id,
    )
    other_fee = StudentFee(
        student_id=other_student.id,
        fee_structure_id=structure.id,
        concession=Decimal("0.00"),
        net_amount=Decimal("1200.00"),
        academic_year_id=year.id,
    )
    db.add_all([fee, other_fee])
    db.flush()

    db.add(OnlinePaymentOrder(
        student_fee_id=fee.id,
        razorpay_order_id="order_unit_1",
        amount=Decimal("500.00"),
        currency="INR",
        status="created",
    ))
    db.add(OnlinePaymentOrder(
        student_fee_id=other_fee.id,
        razorpay_order_id="order_other_1",
        amount=Decimal("500.00"),
        currency="INR",
        status="created",
    ))
    db.add(OnlinePaymentOrder(
        student_fee_id=other_fee.id,
        razorpay_order_id="order_webhook_bad",
        amount=Decimal("300.00"),
        currency="INR",
        status="created",
    ))
    db.add(OnlinePaymentOrder(
        student_fee_id=other_fee.id,
        razorpay_order_id="order_webhook_ok",
        amount=Decimal("300.00"),
        currency="INR",
        status="created",
    ))
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


def token(client, email):
    res = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "parent1234"},
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_verify_payment_creates_fee_payment_and_is_idempotent(client):
    tok = token(client, "parentpay@test.com")
    body = {
        "razorpay_order_id": "order_unit_1",
        "razorpay_payment_id": "pay_unit_1",
        "razorpay_signature": _signature("order_unit_1", "pay_unit_1"),
    }

    res = client.post("/api/v1/payments/verify", json=body, headers=auth(tok))
    assert res.status_code == 200, res.text
    assert res.json()["success"] is True
    receipt = res.json()["receipt_number"]
    assert receipt.startswith("RCPT-")

    second = client.post("/api/v1/payments/verify", json=body, headers=auth(tok))
    assert second.status_code == 200, second.text
    assert second.json()["receipt_number"] == receipt

    db = TestingSessionLocal()
    try:
        payments = db.query(FeePayment).filter_by(online_order_id=1).all()
        assert len(payments) == 1
        assert payments[0].amount_paid == Decimal("500.00")
        assert payments[0].mode == "online"
    finally:
        db.close()


def test_verify_payment_rejects_bad_signature(client):
    tok = token(client, "otherparentpay@test.com")
    res = client.post(
        "/api/v1/payments/verify",
        json={
            "razorpay_order_id": "order_other_1",
            "razorpay_payment_id": "pay_other_1",
            "razorpay_signature": "bad-signature",
        },
        headers=auth(tok),
    )
    assert res.status_code == 400
    assert "signature" in res.json()["detail"].lower()


def test_parent_cannot_verify_unlinked_child_order(client):
    tok = token(client, "parentpay@test.com")
    res = client.post(
        "/api/v1/payments/verify",
        json={
            "razorpay_order_id": "order_other_1",
            "razorpay_payment_id": "pay_other_2",
            "razorpay_signature": _signature("order_other_1", "pay_other_2"),
        },
        headers=auth(tok),
    )
    assert res.status_code == 403


def test_webhook_rejects_amount_mismatch_without_creating_payment(client):
    body = _webhook_body("order_webhook_bad", "pay_webhook_bad", 20000)
    res = client.post(
        "/api/v1/payments/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _webhook_signature(body),
        },
    )

    assert res.status_code == 400
    assert "amount" in res.json()["detail"].lower()

    db = TestingSessionLocal()
    try:
        order = db.query(OnlinePaymentOrder).filter_by(razorpay_order_id="order_webhook_bad").one()
        assert order.status == "failed"
        assert db.query(FeePayment).filter_by(online_order_id=order.id).count() == 0
    finally:
        db.close()


def test_webhook_marks_paid_when_capture_matches_order(client):
    body = _webhook_body("order_webhook_ok", "pay_webhook_ok", 30000)
    res = client.post(
        "/api/v1/payments/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _webhook_signature(body),
        },
    )

    assert res.status_code == 200, res.text

    db = TestingSessionLocal()
    try:
        order = db.query(OnlinePaymentOrder).filter_by(razorpay_order_id="order_webhook_ok").one()
        payment = db.query(FeePayment).filter_by(online_order_id=order.id).one()
        assert order.status == "paid"
        assert order.razorpay_payment_id == "pay_webhook_ok"
        assert payment.amount_paid == Decimal("300.00")
    finally:
        db.close()
