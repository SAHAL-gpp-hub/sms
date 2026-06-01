from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.base_models import AcademicYear, Attendance, Class, FeePayment, NotificationLog, NotificationOutbox, Student, StudentFee, StudentStatusEnum
from app.routers.auth import CurrentUser, require_role
from app.schemas.notifications import (
    NotificationLogOut,
    NotificationPreviewOut,
    TestNotificationRequest,
    TriggerLowAttendanceRequest,
)
from app.services.calendar_service import count_working_days_for_month
from app.services.notification_service import (
    enqueue_fee_due_reminders,
    enqueue_low_attendance_alerts,
    enqueue_template_notification,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


def _provider_state() -> tuple[bool, str | None]:
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        return False, "WhatsApp provider is not configured. Messages can be previewed but sending will queue into a broken channel."
    return True, None


def _phone_for(student: Student) -> str | None:
    return student.guardian_phone or student.contact


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


@router.post("/preview/fee-reminders", response_model=NotificationPreviewOut)
def preview_fee_reminders(
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
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
    balances = (
        db.query(
            StudentFee.student_id.label("student_id"),
            func.coalesce(func.sum(StudentFee.net_amount), 0).label("total_due"),
            func.coalesce(func.sum(payments_by_fee.c.paid_amount), 0).label("total_paid"),
        )
        .outerjoin(payments_by_fee, payments_by_fee.c.student_fee_id == StudentFee.id)
    )
    if academic_year_id is not None:
        balances = balances.filter(StudentFee.academic_year_id == academic_year_id)
    balances = balances.group_by(StudentFee.student_id).subquery()

    rows = (
        db.query(Student, balances.c.total_due, balances.c.total_paid)
        .join(balances, balances.c.student_id == Student.id)
        .filter(Student.status == StudentStatusEnum.Active)
        .all()
    )
    recipients = []
    excluded = []
    for student, total_due, total_paid in rows:
        balance = Decimal(str(total_due)) - Decimal(str(total_paid))
        if balance <= 0:
            continue
        phone = _phone_for(student)
        message = f"{student.name_en} has an outstanding fee of ₹{balance:.0f}. Please pay before this week."
        item = {
            "student_id": student.id,
            "student_name": student.name_en,
            "phone": phone,
            "channel": "whatsapp",
            "message_preview": message,
        }
        if phone:
            recipients.append(item)
        else:
            excluded.append({**item, "excluded_reason": "No guardian/contact phone"})
    provider_ready, provider_warning = _provider_state()
    return {
        "notification_type": "fee_due",
        "recipients": recipients[:100],
        "excluded": excluded[:100],
        "recipient_count": len(recipients),
        "excluded_count": len(excluded),
        "provider_ready": provider_ready,
        "provider_warning": provider_warning,
        "sample_message": recipients[0]["message_preview"] if recipients else None,
    }


@router.post("/preview/low-attendance", response_model=NotificationPreviewOut)
def preview_low_attendance_alerts(
    body: TriggerLowAttendanceRequest,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    today = date.today()
    year = body.year
    month = body.month
    if year is None or month is None:
        last_month_end = date(today.year, today.month, 1) - timedelta(days=1)
        year, month = last_month_end.year, last_month_end.month

    month_label = date(year, month, 1).strftime("%B %Y")
    _, days_in_month = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, days_in_month)
    recipients = []
    excluded = []

    classes = db.query(Class).all()
    working_days_by_year = {
        academic_year_id: count_working_days_for_month(db, academic_year_id, year, month)
        for academic_year_id in {cls.academic_year_id for cls in classes}
    }
    working_days_by_class = {
        cls.id: working_days_by_year.get(cls.academic_year_id, 0)
        for cls in classes
    }
    active_students = (
        db.query(Student)
        .filter(Student.status == StudentStatusEnum.Active)
        .all()
    )
    present_records = (
        db.query(
            Attendance.student_id,
            Attendance.class_id,
            func.count().label("presentish"),
        )
        .filter(
            Attendance.date >= start,
            Attendance.date <= end,
            Attendance.status.in_(["P", "L"] if settings.LATE_COUNTS_AS_PRESENT else ["P"]),
        )
        .group_by(Attendance.student_id, Attendance.class_id)
        .all()
    )
    present_by_student_class = {
        (student_id, class_id): int(count)
        for student_id, class_id, count in present_records
    }

    for student in active_students:
        working_days = working_days_by_class.get(student.class_id, 0)
        if working_days <= 0:
            continue
        pct = round((present_by_student_class.get((student.id, student.class_id), 0) / working_days) * 100, 1)
        if pct >= settings.LOW_ATTENDANCE_THRESHOLD_PERCENT:
            continue
        phone = _phone_for(student)
        message = f"Attendance alert for {student.name_en}: {pct:.1f}% in {month_label}."
        item = {
            "student_id": student.id,
            "student_name": student.name_en,
            "phone": phone,
            "channel": "whatsapp",
            "message_preview": message,
        }
        if phone:
            recipients.append(item)
        else:
            excluded.append({**item, "excluded_reason": "No guardian/contact phone"})
    provider_ready, provider_warning = _provider_state()
    return {
        "notification_type": "low_attendance",
        "recipients": recipients[:100],
        "excluded": excluded[:100],
        "recipient_count": len(recipients),
        "excluded_count": len(excluded),
        "provider_ready": provider_ready,
        "provider_warning": provider_warning,
        "sample_message": recipients[0]["message_preview"] if recipients else None,
    }


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


@router.post("/retry/{outbox_id}")
def retry_notification(
    outbox_id: int,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(require_role("admin")),
):
    item = db.query(NotificationOutbox).filter_by(id=outbox_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    if item.status not in ("failed", "retry"):
        raise HTTPException(status_code=422, detail="Only failed notifications can be retried")
    item.status = "pending"
    item.attempts = 0
    item.next_attempt_at = datetime.now(timezone.utc)
    item.last_error = None
    db.commit()
    return {"message": "Notification queued for retry", "id": outbox_id}
