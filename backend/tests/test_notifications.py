from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base
from app.core.security import get_password_hash
from app.models.base_models import (
    AcademicYear,
    Attendance,
    Class,
    FeeHead,
    FeePayment,
    FeeStructure,
    GenderEnum,
    NotificationLog,
    NotificationOutbox,
    Student,
    StudentFee,
    StudentStatusEnum,
    User,
)
from app.services import notification_service


SQLALCHEMY_TEST_URL = "sqlite:///./test_notifications.db"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_module():
    settings.AUTO_SEND_PAYMENT_CONFIRMATION = True
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
        email="notify-parent@test.com",
        password_hash=get_password_hash("parent1234"),
        role="parent",
        is_active=True,
    )
    db.add(parent)
    db.flush()

    student = Student(
        student_id="SMS-2025-601",
        name_en="Notify Student",
        name_gu="નોટિફાય",
        dob=date(2015, 1, 1),
        gender=GenderEnum.M,
        class_id=cls.id,
        father_name="Notify Father",
        contact="9876543210",
        guardian_phone="9876543210",
        admission_date=date(2025, 6, 1),
        academic_year_id=year.id,
        status=StudentStatusEnum.Active,
        parent_user_id=parent.id,
    )
    db.add(student)
    db.flush()

    head = FeeHead(name="Tuition Fee", frequency="Monthly", is_active=True)
    db.add(head)
    db.flush()

    structure = FeeStructure(
        class_id=cls.id,
        fee_head_id=head.id,
        amount=Decimal("1000.00"),
        academic_year_id=year.id,
    )
    db.add(structure)
    db.flush()

    fee = StudentFee(
        student_id=student.id,
        fee_structure_id=structure.id,
        concession=Decimal("0.00"),
        net_amount=Decimal("1000.00"),
        academic_year_id=year.id,
    )
    db.add(fee)
    db.flush()

    payment = FeePayment(
        student_fee_id=fee.id,
        amount_paid=Decimal("500.00"),
        payment_date=date.today(),
        mode="cash",
        receipt_number="RCPT-TEST-001",
    )
    db.add(payment)
    db.commit()
    db.close()


def teardown_module():
    Base.metadata.drop_all(bind=engine)


def test_payment_confirmation_enqueue_is_idempotent():
    db = TestingSessionLocal()
    try:
        notification_service.enqueue_payment_confirmation(db, 1)
        notification_service.enqueue_payment_confirmation(db, 1)
        db.commit()

        logs = db.query(NotificationLog).all()
        outbox = db.query(NotificationOutbox).all()
        assert len(logs) == 1
        assert len(outbox) == 1
        assert logs[0].notification_type == "payment_confirmed"
        assert logs[0].template_name == "payment_receipt_pdf"
        assert logs[0].idempotency_key == "payment_receipt:1:whatsapp"
        assert outbox[0].payload.get("message_type") == "document"
        assert "/api/v1/pdf/receipt/1?token=" in outbox[0].payload.get("document_link", "")
    finally:
        db.close()


def test_process_pending_notification_updates_log(monkeypatch):
    sent = []

    def fake_send(*, phone, document_link, filename, caption=None):
        sent.append((phone, document_link, filename, caption))
        return {"messages": [{"id": "wamid.test"}]}

    monkeypatch.setattr(notification_service, "send_whatsapp_document", fake_send)
    db = TestingSessionLocal()
    try:
        processed = notification_service.process_pending_notifications(db)
        assert processed == 1
        log = db.query(NotificationLog).first()
        item = db.query(NotificationOutbox).first()
        assert log.status == "sent"
        assert item.status == "sent"
        assert "/api/v1/pdf/receipt/1?token=" in sent[0][1]
    finally:
        db.close()


def test_fee_due_reminder_uses_fee_totals_without_payment_join_duplication():
    previous = settings.AUTO_SEND_FEE_REMINDERS
    settings.AUTO_SEND_FEE_REMINDERS = True
    db = TestingSessionLocal()
    try:
        db.query(NotificationLog).delete()
        db.query(NotificationOutbox).delete()
        fee = db.query(StudentFee).first()
        db.add(FeePayment(
            student_fee_id=fee.id,
            amount_paid=Decimal("300.00"),
            payment_date=date.today(),
            mode="cash",
            receipt_number="RCPT-TEST-002",
        ))
        db.commit()

        queued = notification_service.enqueue_fee_due_reminders(db, academic_year_id=fee.academic_year_id)
        log = db.query(NotificationLog).filter_by(notification_type="fee_due").one()

        assert queued == 1
        assert "₹200" in log.message_preview
        assert "₹1200" not in log.message_preview
    finally:
        settings.AUTO_SEND_FEE_REMINDERS = previous
        db.close()


def test_low_attendance_alert_ignores_attendance_from_other_class():
    previous = settings.AUTO_SEND_LOW_ATTENDANCE_ALERTS
    settings.AUTO_SEND_LOW_ATTENDANCE_ALERTS = True
    db = TestingSessionLocal()
    try:
        db.query(NotificationLog).delete()
        db.query(NotificationOutbox).delete()
        year = db.query(AcademicYear).first()
        cls = db.query(Class).first()
        other_cls = Class(name="6", division="B", academic_year_id=year.id)
        db.add(other_cls)
        db.flush()
        student = db.query(Student).filter_by(class_id=cls.id).first()
        db.add(Attendance(
            student_id=student.id,
            class_id=other_cls.id,
            date=date(2025, 7, 1),
            status="P",
        ))
        db.commit()

        queued = notification_service.enqueue_low_attendance_alerts(db, year=2025, month=7)
        log = db.query(NotificationLog).filter_by(notification_type="low_attendance").one()

        assert queued == 1
        assert "0.0% in July 2025" in log.message_preview
    finally:
        settings.AUTO_SEND_LOW_ATTENDANCE_ALERTS = previous
        db.close()


def test_whatsapp_otp_enqueues_pending_outbox_item():
    db = TestingSessionLocal()
    try:
        item = notification_service.notification_service.enqueue_otp(
            db,
            "whatsapp",
            "9876543210",
            "123456",
            {"template_name": "portal_activation_code", "params": ["123456"]},
        )
        db.commit()

        assert item.status == "pending"
        assert item.last_error is None
    finally:
        db.close()
