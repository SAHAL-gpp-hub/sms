from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.base_models import NotificationLog
from app.routers.auth import CurrentUser, require_role
from app.schemas.notifications import (
    NotificationLogOut,
    TestNotificationRequest,
    TriggerLowAttendanceRequest,
)
from app.services.notification_service import (
    enqueue_fee_due_reminders,
    enqueue_low_attendance_alerts,
    enqueue_template_notification,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationLogOut])
def list_notifications(
    notification_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    query = db.query(NotificationLog)
    if notification_type:
        query = query.filter(NotificationLog.notification_type == notification_type)
    if status:
        query = query.filter(NotificationLog.status == status)
    if channel:
        query = query.filter(NotificationLog.channel == channel)
    return query.order_by(NotificationLog.created_at.desc(), NotificationLog.id.desc()).limit(limit).all()


@router.post("/trigger/fee-reminders")
def trigger_fee_reminders(
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    queued = enqueue_fee_due_reminders(db, academic_year_id=academic_year_id)
    return {"queued": queued}


@router.post("/trigger/low-attendance")
def trigger_low_attendance_alerts(
    body: TriggerLowAttendanceRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    queued = enqueue_low_attendance_alerts(db, year=body.year, month=body.month)
    return {"queued": queued}


@router.post("/test")
def send_test_notification(
    body: TestNotificationRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    today_key = date.today().isoformat()
    if body.channel == "sms":
        template_name = "sms_test"
        fallback = "Iqra School notification test. If you received this, SMS delivery is working."
        params = []
    else:
        template_name = "payment_confirmation"
        params = ["Parent", "₹1", "Test Student", "TEST-RECEIPT"]
        fallback = "Iqra School WhatsApp test message."

    log = enqueue_template_notification(
        db,
        student_id=None,
        notification_type="test",
        channel=body.channel,
        phone=body.phone,
        template_name=template_name,
        params=params,
        idempotency_key=f"test:{body.channel}:{body.phone}:{today_key}",
        fallback_body=fallback,
    )
    db.commit()
    return {"queued": True, "notification_id": log.id}
