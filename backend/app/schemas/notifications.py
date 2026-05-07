from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class NotificationLogOut(BaseModel):
    id: int
    student_id: Optional[int] = None
    notification_type: str
    channel: str
    recipient_phone: str
    template_name: Optional[str] = None
    message_preview: Optional[str] = None
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


class TriggerLowAttendanceRequest(BaseModel):
    year: Optional[int] = None
    month: Optional[int] = None
