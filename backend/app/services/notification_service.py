import asyncio
import logging
import smtplib
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from email.message import EmailMessage
from typing import Protocol

import httpx
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.base_models import (
    AcademicYear,
    Attendance,
    Class,
    FeePayment,
    FeeStructure,
    NotificationLog,
    NotificationOutbox,
    Student,
    StudentFee,
    StudentStatusEnum,
)
from app.services.calendar_service import count_working_days_for_month

logger = logging.getLogger("sms.notifications")


class OTPProvider(Protocol):
    provider_name: str

    def enqueue_otp(self, db: Session, destination: str, otp: str, context: dict) -> NotificationOutbox:
        ...

    def send_outbox(self, item: NotificationOutbox) -> None:
        ...


class EmailOTPProvider:
    provider_name = "email"

    def enqueue_otp(self, db: Session, destination: str, otp: str, context: dict) -> NotificationOutbox:
        account_label = "student" if context.get("account_type") == "student" else "parent"
        subject = "Your school portal activation code"
        body = (
            f"Hello {context.get('name', 'there')},\n\n"
            f"Your {account_label} portal activation code is {otp}.\n"
            f"This code expires in {settings.ACTIVATION_OTP_EXPIRE_MINUTES} minutes.\n\n"
            "If you did not request this, please ignore this message or contact the school office."
        )
        item = NotificationOutbox(
            provider=self.provider_name,
            destination=destination,
            subject=subject,
            body=body,
            payload={
                "activation_id": context.get("activation_id"),
                "account_type": context.get("account_type"),
                "student_id": context.get("student_id"),
            },
        )
        db.add(item)
        return item

    def send_outbox(self, item: NotificationOutbox) -> None:
        if not settings.SMTP_HOST:
            raise RuntimeError("SMTP_HOST is not configured")

        message = EmailMessage()
        message["Subject"] = item.subject or "School portal notification"
        message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        message["To"] = item.destination
        message.set_content(item.body)

        if settings.SMTP_USE_SSL:
            smtp = smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=settings.SMTP_TIMEOUT_SECONDS,
            )
        else:
            smtp = smtplib.SMTP(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=settings.SMTP_TIMEOUT_SECONDS,
            )

        with smtp:
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                smtp.starttls()
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
            smtp.send_message(message)


class WhatsAppOTPProvider:
    provider_name = "whatsapp"

    def enqueue_otp(self, db: Session, destination: str, otp: str, context: dict) -> NotificationOutbox:
        item = NotificationOutbox(
            provider=self.provider_name,
            destination=destination,
            subject="School portal activation code",
            body=f"Your school portal activation code is {otp}.",
            payload=context,
        )
        db.add(item)
        return item

    def send_outbox(self, item: NotificationOutbox) -> None:
        send_whatsapp_template(
            phone=item.destination,
            template_name=item.payload.get("template_name") if item.payload else "portal_activation_code",
            params=(item.payload or {}).get("params", []),
        )


class SMSOTPProvider:
    provider_name = "sms"

    def enqueue_otp(self, db: Session, destination: str, otp: str, context: dict) -> NotificationOutbox:
        item = NotificationOutbox(
            provider=self.provider_name,
            destination=destination,
            subject="School portal activation code",
            body=f"Your school portal activation code is {otp}.",
            payload=context,
        )
        db.add(item)
        return item

    def send_outbox(self, item: NotificationOutbox) -> None:
        send_sms(item.destination, item.body)


class ActivationNotificationService:
    def __init__(self) -> None:
        self.providers: dict[str, OTPProvider] = {
            "email": EmailOTPProvider(),
            "whatsapp": WhatsAppOTPProvider(),
            "sms": SMSOTPProvider(),
        }

    def enqueue_otp(
        self,
        db: Session,
        provider_name: str,
        destination: str,
        otp: str,
        context: dict,
    ) -> NotificationOutbox:
        provider = self.providers.get(provider_name)
        if provider is None:
            raise ValueError(f"Unknown OTP provider: {provider_name}")
        return provider.enqueue_otp(db, destination, otp, context)

    def send_outbox(self, item: NotificationOutbox) -> None:
        provider = self.providers.get(item.provider)
        if provider is None:
            raise ValueError(f"Unknown notification provider: {item.provider}")
        provider.send_outbox(item)


notification_service = ActivationNotificationService()


def _normalize_indian_phone(phone: str | None) -> str:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10:
        raise ValueError("Recipient phone must be a 10-digit Indian mobile number")
    return digits


def send_whatsapp_template(phone: str, template_name: str, params: list[str]) -> dict:
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        raise RuntimeError("WhatsApp Cloud API is not configured")

    destination = _normalize_indian_phone(phone)
    url = (
        f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/"
        f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": f"91{destination}",
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "en"},
            "components": [{
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in params],
            }],
        },
    }
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=10.0) as client:
        response = client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()


def send_sms(phone: str, message: str) -> dict:
    if settings.SMS_PROVIDER != "msg91":
        raise RuntimeError(f"Unsupported SMS provider: {settings.SMS_PROVIDER}")
    if not settings.MSG91_AUTH_KEY or not settings.MSG91_SENDER_ID:
        raise RuntimeError("MSG91 SMS is not configured")

    destination = _normalize_indian_phone(phone)
    payload = {
        "sender": settings.MSG91_SENDER_ID,
        "route": "4",
        "country": "91",
        "sms": [{"message": message, "to": [destination]}],
    }
    headers = {"authkey": settings.MSG91_AUTH_KEY, "Content-Type": "application/json"}
    with httpx.Client(timeout=10.0) as client:
        response = client.post("https://api.msg91.com/api/v2/sendsms", json=payload, headers=headers)
        response.raise_for_status()
        return response.json()


TEMPLATE_PREVIEWS = {
    "payment_confirmation": "Payment of {1} received for {2}. Receipt: {3}.",
    "fee_due_reminder": "{2} has outstanding fees of {3} for {4}.",
    "low_attendance_alert": "Attendance alert for {2}: {3}% in {4}.",
    "result_published": "{2}'s {3} results are available. Overall: {4}.",
}


def _preview(template_name: str, params: list[str]) -> str:
    preview = TEMPLATE_PREVIEWS.get(template_name, template_name)
    for idx, value in enumerate(params, start=1):
        preview = preview.replace(f"{{{idx}}}", str(value))
    return preview


def enqueue_template_notification(
    db: Session,
    *,
    student_id: int | None,
    notification_type: str,
    channel: str,
    phone: str,
    template_name: str,
    params: list[str],
    idempotency_key: str,
    fallback_body: str | None = None,
) -> NotificationLog:
    destination = _normalize_indian_phone(phone)
    existing = (
        db.query(NotificationLog)
        .filter(NotificationLog.idempotency_key == idempotency_key)
        .first()
    )
    if existing:
        return existing

    body = fallback_body or _preview(template_name, params)
    item = NotificationOutbox(
        provider=channel,
        destination=destination,
        subject=template_name,
        body=body,
        payload={
            "student_id": student_id,
            "notification_type": notification_type,
            "template_name": template_name,
            "params": [str(p) for p in params],
        },
    )
    db.add(item)
    db.flush()

    log = NotificationLog(
        student_id=student_id,
        notification_type=notification_type,
        channel=channel,
        recipient_phone=destination,
        template_name=template_name,
        message_preview=body,
        status="queued",
        idempotency_key=idempotency_key,
        outbox_id=item.id,
    )
    db.add(log)
    db.flush()
    return log


def enqueue_payment_confirmation(db: Session, payment_id: int) -> NotificationLog | None:
    if not settings.AUTO_SEND_PAYMENT_CONFIRMATION:
        return None

    payment = (
        db.query(FeePayment)
        .join(StudentFee, StudentFee.id == FeePayment.student_fee_id)
        .join(Student, Student.id == StudentFee.student_id)
        .filter(FeePayment.id == payment_id)
        .first()
    )
    if not payment:
        return None
    student_fee = db.query(StudentFee).filter_by(id=payment.student_fee_id).first()
    student = db.query(Student).filter_by(id=student_fee.student_id).first() if student_fee else None
    if not student:
        return None

    amount = f"₹{Decimal(str(payment.amount_paid)):.0f}"
    params = [
        student.father_name or "Parent",
        amount,
        student.name_en,
        payment.receipt_number,
    ]
    return enqueue_template_notification(
        db,
        student_id=student.id,
        notification_type="payment_confirmed",
        channel="whatsapp",
        phone=student.guardian_phone or student.contact,
        template_name="payment_confirmation",
        params=params,
        idempotency_key=f"payment_confirmed:{payment.id}:whatsapp",
        fallback_body=(
            f"Dear {params[0]}, payment of {amount} received for "
            f"{student.name_en}. Receipt No: {payment.receipt_number}."
        ),
    )


def enqueue_fee_due_reminders(db: Session, academic_year_id: int | None = None) -> int:
    if not settings.AUTO_SEND_FEE_REMINDERS:
        return 0

    if academic_year_id is None:
        current = db.query(AcademicYear).filter_by(is_current=True).first()
        academic_year_id = current.id if current else None

    payments_by_fee = (
        db.query(
            FeePayment.student_fee_id.label("student_fee_id"),
            func.coalesce(func.sum(FeePayment.amount_paid), 0).label("paid_amount"),
        )
        .group_by(FeePayment.student_fee_id)
        .subquery()
    )

    balances_by_student = (
        db.query(
            StudentFee.student_id.label("student_id"),
            func.coalesce(func.sum(StudentFee.net_amount), 0).label("total_due"),
            func.coalesce(func.sum(payments_by_fee.c.paid_amount), 0).label("total_paid"),
        )
        .outerjoin(payments_by_fee, payments_by_fee.c.student_fee_id == StudentFee.id)
    )
    if academic_year_id is not None:
        balances_by_student = balances_by_student.filter(StudentFee.academic_year_id == academic_year_id)
    balances_by_student = balances_by_student.group_by(StudentFee.student_id).subquery()

    query = (
        db.query(Student, balances_by_student.c.total_due, balances_by_student.c.total_paid)
        .join(balances_by_student, balances_by_student.c.student_id == Student.id)
        .filter(Student.status == StudentStatusEnum.Active)
    )

    queued = 0
    week_key = date.today().strftime("%G-W%V")
    for student, total_due, total_paid in query.all():
        balance = Decimal(str(total_due)) - Decimal(str(total_paid))
        if balance <= 0:
            continue
        params = [
            student.father_name or "Parent",
            student.name_en,
            f"₹{balance:.0f}",
            "school fees",
            "this week",
        ]
        enqueue_template_notification(
            db,
            student_id=student.id,
            notification_type="fee_due",
            channel="whatsapp",
            phone=student.guardian_phone or student.contact,
            template_name="fee_due_reminder",
            params=params,
            idempotency_key=f"fee_due:{week_key}:{student.id}:whatsapp",
            fallback_body=(
                f"Hello {params[0]}, {student.name_en} has an outstanding "
                f"fee of ₹{balance:.0f}. Please pay before this week."
            ),
        )
        queued += 1
    db.commit()
    return queued


def enqueue_low_attendance_alerts(db: Session, year: int | None = None, month: int | None = None) -> int:
    if not settings.AUTO_SEND_LOW_ATTENDANCE_ALERTS:
        return 0

    today = date.today()
    if year is None or month is None:
        last_month_end = date(today.year, today.month, 1) - timedelta(days=1)
        year, month = last_month_end.year, last_month_end.month

    month_label = date(year, month, 1).strftime("%B %Y")
    _, days_in_month = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, days_in_month)
    queued = 0

    classes = db.query(Class).all()
    for cls in classes:
        working_days = count_working_days_for_month(db, cls.academic_year_id, year, month)
        if working_days <= 0:
            continue
        records = (
            db.query(Student.id, func.count().label("presentish"))
            .join(Attendance, Attendance.student_id == Student.id)
            .filter(
                Student.class_id == cls.id,
                Student.status == StudentStatusEnum.Active,
                Attendance.class_id == cls.id,
                Attendance.date >= start,
                Attendance.date <= end,
                Attendance.status.in_(["P", "L"] if settings.LATE_COUNTS_AS_PRESENT else ["P"]),
            )
            .group_by(Student.id)
            .all()
        )
        present_by_student = {sid: int(count) for sid, count in records}
        students = db.query(Student).filter_by(class_id=cls.id, status=StudentStatusEnum.Active).all()
        for student in students:
            percentage = round((present_by_student.get(student.id, 0) / working_days) * 100, 1)
            if percentage >= settings.LOW_ATTENDANCE_THRESHOLD_PERCENT:
                continue
            params = [
                student.father_name or "Parent",
                student.name_en,
                f"{percentage:.1f}",
                month_label,
            ]
            enqueue_template_notification(
                db,
                student_id=student.id,
                notification_type="low_attendance",
                channel="whatsapp",
                phone=student.guardian_phone or student.contact,
                template_name="low_attendance_alert",
                params=params,
                idempotency_key=f"low_attendance:{year}-{month:02d}:{student.id}:whatsapp",
                fallback_body=(
                    f"Dear {params[0]}, attendance alert for {student.name_en}: "
                    f"{percentage:.1f}% in {month_label}. Minimum required is 75%."
                ),
            )
            queued += 1
    db.commit()
    return queued


def process_pending_notifications(db: Session, limit: int = 20) -> int:
    now = datetime.now(timezone.utc)
    stale_before = now - timedelta(minutes=15)
    recovered = db.query(NotificationOutbox).filter(
        NotificationOutbox.status == "sending",
        NotificationOutbox.updated_at <= stale_before,
        NotificationOutbox.attempts < NotificationOutbox.max_attempts,
    ).update(
        {
            "status": "retry",
            "next_attempt_at": now,
            "last_error": "Recovered after being stuck in sending state.",
        },
        synchronize_session=False,
    )
    if recovered:
        db.commit()
    items = (
        db.query(NotificationOutbox)
        .filter(
            NotificationOutbox.status.in_(["pending", "retry"]),
            NotificationOutbox.next_attempt_at <= now,
            NotificationOutbox.attempts < NotificationOutbox.max_attempts,
        )
        .order_by(NotificationOutbox.created_at)
        .limit(limit)
        .with_for_update(skip_locked=True)
        .all()
    )
    sent = 0
    for item in items:
        item.status = "sending"
        item.attempts += 1
        db.commit()
        try:
            notification_service.send_outbox(item)
        except Exception as exc:
            item.last_error = str(exc)
            if item.attempts >= item.max_attempts:
                item.status = "failed"
            else:
                item.status = "retry"
                item.next_attempt_at = now + timedelta(minutes=item.attempts * 2)
            if item.payload and item.payload.get("notification_type"):
                log = db.query(NotificationLog).filter_by(outbox_id=item.id).first()
                if log:
                    log.status = item.status
                    log.error_message = str(exc)
            logger.warning("Notification delivery failed for outbox %s: %s", item.id, exc)
            db.commit()
        else:
            item.status = "sent"
            item.sent_at = now
            if item.payload and item.payload.get("notification_type"):
                log = db.query(NotificationLog).filter_by(outbox_id=item.id).first()
                if log:
                    log.status = "sent"
                    log.sent_at = now
            sent += 1
            db.commit()
    return sent


async def run_notification_worker(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            with SessionLocal() as db:
                process_pending_notifications(db)
        except Exception as exc:
            logger.exception("Notification worker failed: %s", exc)
        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=settings.NOTIFICATION_WORKER_INTERVAL_SECONDS,
            )
        except asyncio.TimeoutError:
            pass
