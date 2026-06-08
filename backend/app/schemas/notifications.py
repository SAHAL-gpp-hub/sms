from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class NotificationLogOut(BaseModel):
    id: int
    student_id: Optional[int] = None
    sender_user_id: Optional[int] = None
    sender_name: Optional[str] = None
    notification_type: str
    channel: str
    recipient_phone: str
    recipients: Optional[list[str]] = None
    template_name: Optional[str] = None
    message_preview: Optional[str] = None
    sent_count: Optional[int] = None
    failed_count: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    idempotency_key: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TestNotificationRequest(BaseModel):
    phone: str
    channel: str = "whatsapp"

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, value: str) -> str:
        if value not in {"whatsapp", "sms"}:
            raise ValueError("Channel must be whatsapp or sms")
        return value


class ChannelRequestMixin(BaseModel):
    channel: str = "whatsapp"

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, value: str) -> str:
        value = value.lower().strip()
        if value not in {"whatsapp", "sms", "both"}:
            raise ValueError("Channel must be WhatsApp, SMS, or Both")
        return value


class SendRegistrationLinkRequest(ChannelRequestMixin):
    class_ids: list[int] = Field(min_length=1)


class SendCustomMessageRequest(ChannelRequestMixin):
    recipient_type: str
    class_id: Optional[int] = None
    student_id: Optional[int] = None
    message: str = Field(min_length=1, max_length=1000)

    @field_validator("recipient_type")
    @classmethod
    def validate_recipient_type(cls, value: str) -> str:
        value = value.lower().strip()
        if value not in {"all_students", "all_parents", "specific_class", "specific_student"}:
            raise ValueError("Invalid recipient type")
        return value

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message is required")
        return value


class SendNotificationResponse(BaseModel):
    sent: int
    failed: int


class TriggerLowAttendanceRequest(BaseModel):
    year: Optional[int] = None
    month: Optional[int] = None


class NotificationPreviewRecipient(BaseModel):
    student_id: int
    student_name: str
    phone: Optional[str] = None
    channel: str = "whatsapp"
    message_preview: str
    excluded_reason: Optional[str] = None


class NotificationPreviewOut(BaseModel):
    notification_type: str
    recipients: list[NotificationPreviewRecipient]
    excluded: list[NotificationPreviewRecipient] = []
    recipient_count: int
    excluded_count: int
    provider_ready: bool
    provider_warning: Optional[str] = None
    sample_message: Optional[str] = None
