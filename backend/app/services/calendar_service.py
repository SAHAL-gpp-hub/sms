"""
calendar_service.py

Manages the academic_calendar table.
Provides holiday-aware working day calculation for attendance denominators.
Previously attendance used a hardcoded "exclude Sundays" rule —
now it uses the actual school calendar.
"""

from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.base_models import AcademicCalendar, AcademicYear


# ─────────────────────────────────────────────────────────────────────────────
# CRUD
# ─────────────────────────────────────────────────────────────────────────────

def create_event(
    db: Session,
    academic_year_id: int,
    event_type: str,
    title: str,
    start_date: date,
    end_date: date,
    description: Optional[str] = None,
    affects_attendance: bool = True,
) -> AcademicCalendar:
    event = AcademicCalendar(
        academic_year_id   = academic_year_id,
        event_type         = event_type,
        title              = title,
        start_date         = start_date,
        end_date           = end_date,
        description        = description,
        affects_attendance = affects_attendance,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_events(
    db: Session,
    academic_year_id: int,
    event_type: Optional[str] = None,
) -> list[AcademicCalendar]:
    q = db.query(AcademicCalendar).filter_by(academic_year_id=academic_year_id)
    if event_type:
        q = q.filter(AcademicCalendar.event_type == event_type)
    return q.order_by(AcademicCalendar.start_date).all()


def update_event(
    db: Session,
    event_id: int,
    **kwargs,
) -> Optional[AcademicCalendar]:
    event = db.query(AcademicCalendar).filter_by(id=event_id).first()
    if not event:
        return None
    for key, value in kwargs.items():
        if hasattr(event, key) and value is not None:
            setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, event_id: int) -> bool:
    event = db.query(AcademicCalendar).filter_by(id=event_id).first()
    if not event:
        return False
    db.delete(event)
    db.commit()
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Working day calculation (the key fix for attendance denominators)
# ─────────────────────────────────────────────────────────────────────────────

def get_holiday_dates(db: Session, academic_year_id: int) -> set[date]:
    """
    Returns all dates that are marked as holidays / affect attendance
    for a given academic year.
    """
    events = db.query(AcademicCalendar).filter(
        AcademicCalendar.academic_year_id   == academic_year_id,
        AcademicCalendar.affects_attendance == True,    # noqa: E712
    ).all()

    holiday_dates: set[date] = set()
    for event in events:
        current = event.start_date
        while current <= event.end_date:
            holiday_dates.add(current)
            current += timedelta(days=1)

    return holiday_dates


def count_working_days(
    db: Session,
    academic_year_id: int,
    from_date: date,
    to_date: date,
) -> int:
    """
    Counts working days between from_date and to_date (inclusive).
    Excludes: Sundays + all calendar holidays that affect attendance.

    Falls back to Sunday-exclusion-only if academic_year_id is not provided
    or calendar is empty (backwards compat).
    """
    if to_date < from_date:
        return 0

    holiday_dates = get_holiday_dates(db, academic_year_id) if academic_year_id else set()

    count   = 0
    current = from_date
    while current <= to_date:
        if current.weekday() != 6 and current not in holiday_dates:  # not Sunday, not holiday
            count += 1
        current += timedelta(days=1)

    return count


def count_working_days_for_month(
    db: Session,
    academic_year_id: int,
    year: int,
    month: int,
) -> int:
    """
    Convenience wrapper for the attendance monthly summary.
    """
    from calendar import monthrange
    _, days_in_month = monthrange(year, month)
    return count_working_days(
        db,
        academic_year_id,
        date(year, month, 1),
        date(year, month, days_in_month),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Seed: Common Gujarat school holidays
# ─────────────────────────────────────────────────────────────────────────────

GUJARAT_STANDARD_HOLIDAYS_2025_26 = [
    # (title, start_date, end_date, event_type)
    ("Summer Vacation",         date(2025, 4, 15), date(2025, 6, 10), "holiday"),
    ("Independence Day",        date(2025, 8, 15), date(2025, 8, 15), "holiday"),
    ("Janmashtami",             date(2025, 8, 16), date(2025, 8, 16), "holiday"),
    ("Gandhi Jayanti",          date(2025, 10, 2), date(2025, 10, 2), "holiday"),
    ("Navratri",                date(2025, 10, 2), date(2025, 10, 11), "holiday"),
    ("Diwali Vacation",         date(2025, 10, 20), date(2025, 10, 25), "holiday"),
    ("Diwali",                  date(2025, 10, 20), date(2025, 10, 23), "holiday"),
    ("Republic Day",            date(2026, 1, 26), date(2026, 1, 26), "holiday"),
    ("Maha Shivratri",          date(2026, 2, 26), date(2026, 2, 26), "holiday"),
    ("Holi",                    date(2026, 3, 3),  date(2026, 3, 4),  "holiday"),
    ("Annual Exam Period",      date(2026, 3, 1),  date(2026, 3, 31), "exam_period"),
    ("Term 1",                  date(2025, 6, 11), date(2025, 10, 18), "term_start"),
    ("Term 2",                  date(2025, 11, 1), date(2026, 3, 31), "term_start"),
]


def seed_standard_holidays(db: Session, academic_year_id: int) -> int:
    """Seeds standard Gujarat school holidays for 2025-26."""
    created = 0
    for title, start, end, etype in GUJARAT_STANDARD_HOLIDAYS_2025_26:
        exists = db.query(AcademicCalendar).filter_by(
            academic_year_id=academic_year_id,
            title=title,
            start_date=start,
        ).first()
        if not exists:
            db.add(AcademicCalendar(
                academic_year_id   = academic_year_id,
                event_type         = etype,
                title              = title,
                start_date         = start,
                end_date           = end,
                affects_attendance = etype in ("holiday", "exam_period"),
            ))
            created += 1
    db.commit()
    return created
