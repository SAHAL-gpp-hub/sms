import asyncio
import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Protocol

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.base_models import NotificationOutbox

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
            status="failed",
            last_error="WhatsApp OTP provider is not configured yet.",
        )
        db.add(item)
        return item

    def send_outbox(self, item: NotificationOutbox) -> None:
        raise RuntimeError("WhatsApp OTP provider is not configured yet")


class ActivationNotificationService:
    def __init__(self) -> None:
        self.providers: dict[str, OTPProvider] = {
            "email": EmailOTPProvider(),
            "whatsapp": WhatsAppOTPProvider(),
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


def process_pending_notifications(db: Session, limit: int = 20) -> int:
    now = datetime.now(timezone.utc)
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
        try:
            notification_service.send_outbox(item)
        except Exception as exc:
            item.last_error = str(exc)
            if item.attempts >= item.max_attempts:
                item.status = "failed"
            else:
                item.status = "retry"
                item.next_attempt_at = now + timedelta(minutes=item.attempts * 2)
            logger.warning("Notification delivery failed for outbox %s: %s", item.id, exc)
        else:
            item.status = "sent"
            item.sent_at = now
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
