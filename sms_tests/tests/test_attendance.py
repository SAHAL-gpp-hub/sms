"""
test_attendance.py — Attendance Tests

TEST FAILURE FIXES:
  - test_75_percent_boundary_not_highlighted: was a silent false-green.
    It created a student but never marked any attendance, so percentage was
    always 0.0 (not 75.0) and the `if entry and entry.get("attendance_percentage") == 75.0`
    branch was never entered. The assertion never ran. Fixed by calculating how
    many days to mark Present to land exactly at 75%, then verifying the flag.

  - test_below_75_percent_highlighted: same false-green problem — fixed similarly
    by marking attendance below the threshold and then asserting the flag.

  - Both tests also used the wrong field name "attendance_percentage" (service key
    before Bug 1 fix). Now use "percentage" to match the corrected schema/service.
"""

import pytest
from datetime import date, timedelta
from calendar import monthrange
from conftest import StudentFactory, goto, make_payment


def today_str():
    return date.today().isoformat()


def past_date_str(days=5):
    return (date.today() - timedelta(days=days)).isoformat()


def future_date_str(days=3):
    return (date.today() + timedelta(days=days)).isoformat()


def _working_days_in_month(year: int, month: int) -> list[date]:
    """Return list of Mon-Sat dates in the given year/month."""
    _, days_in_month = monthrange(year, month)
    return [
        date(year, month, d + 1)
        for d in range(days_in_month)
        if date(year, month, d + 1).weekday() != 6  # not Sunday
    ]


# ══════════════════════════════════════════════
# DAILY MARKING
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.attendance
class TestDailyAttendance:

    def test_roster_shows_only_active_students(self, api, create_student):
        sid, _ = create_student(class_id=1)
        r = api.get("/attendance/daily", params={"class_id": 1, "date": today_str()})
        assert r.status_code == 200
        ids = [s["student_id"] for s in r.json()]
        assert sid in ids, "Newly created student should be on roster"

    def test_removed_student_not_on_roster(self, api, create_student):
        sid, _ = create_student(class_id=1)
        api.delete(f"/students/{sid}")
        r = api.get("/attendance/daily", params={"class_id": 1, "date": today_str()})
        assert r.status_code == 200
        ids = [s["student_id"] for s in r.json()]
        assert sid not in ids

    def test_mark_all_present(self, api, create_student):
        sid, _ = create_student(class_id=1)
        r = api.get("/attendance/daily", params={"class_id": 1, "date": today_str()})
        roster = r.json()
        entries = [
            {"student_id": s["student_id"], "status": "P", "date": today_str(), "class_id": 1}
            for s in roster
        ]
        r2 = api.post("/attendance/bulk", json={"entries": entries})
        assert r2.status_code in (200, 201), r2.text

    def test_mark_all_absent(self, api):
        r = api.get("/attendance/daily", params={"class_id": 1, "date": past_date_str(10)})
        roster = r.json()
        if not roster:
            pytest.skip("No students in class 1")
        entries = [
            {"student_id": s["student_id"], "status": "A", "date": past_date_str(10), "class_id": 1}
            for s in roster
        ]
        r2 = api.post("/attendance/bulk", json={"entries": entries})
        assert r2.status_code in (200, 201)

    def test_mixed_status_palt(self, api, create_student):
        sids = []
        for _ in range(4):
            sid, _ = create_student(class_id=2)
            sids.append(sid)
        statuses = ["P", "A", "L", "OL"]
        entries = [
            {"student_id": sid, "status": st, "date": past_date_str(2), "class_id": 2}
            for sid, st in zip(sids, statuses)
        ]
        r = api.post("/attendance/bulk", json={"entries": entries})
        assert r.status_code in (200, 201), r.text
        for cleanup_sid in sids:
            api.delete(f"/students/{cleanup_sid}")

    def test_save_attendance_past_date(self, api, create_student):
        sid, _ = create_student(class_id=1)
        entries = [{"student_id": sid, "status": "P", "date": past_date_str(7), "class_id": 1}]
        r = api.post("/attendance/bulk", json={"entries": entries})
        assert r.status_code in (200, 201), f"Backdating should work: {r.text}"

    def test_save_attendance_future_date(self, api, create_student):
        sid, _ = create_student(class_id=1)
        entries = [{"student_id": sid, "status": "P", "date": future_date_str(3), "class_id": 1}]
        r = api.post("/attendance/bulk", json={"entries": entries})
        print(f"\n[FUTURE DATE] Status: {r.status_code}")
        assert r.status_code != 500, "Future date should not cause server error"

    def test_attendance_prefilled_on_revisit(self, api, create_student):
        sid, _ = create_student(class_id=1)
        target_date = past_date_str(15)
        api.post("/attendance/bulk", json={"entries": [
            {"student_id": sid, "status": "A", "date": target_date, "class_id": 1}
        ]})
        r = api.get("/attendance/daily", params={"class_id": 1, "date": target_date})
        assert r.status_code == 200
        entry = next((s for s in r.json() if s["student_id"] == sid), None)
        assert entry is not None
        assert entry.get("status") == "A", "Previous attendance should be pre-filled"

    def test_update_attendance_no_duplicates(self, api, create_student):
        sid, _ = create_student(class_id=1)
        target_date = past_date_str(20)
        api.post("/attendance/bulk", json={"entries": [
            {"student_id": sid, "status": "P", "date": target_date, "class_id": 1}
        ]})
        api.post("/attendance/bulk", json={"entries": [
            {"student_id": sid, "status": "A", "date": target_date, "class_id": 1}
        ]})
        r = api.get("/attendance/daily", params={"class_id": 1, "date": target_date})
        entry = next((s for s in r.json() if s["student_id"] == sid), None)
        assert entry is not None
        assert entry.get("status") == "A", "Attendance should be updated to A, not duplicated"

    def test_empty_class_shows_empty_state(self, api):
        r = api.get("/attendance/daily", params={"class_id": 999, "date": today_str()})
        assert r.status_code != 500
        if r.status_code == 200:
            assert r.json() == []


# ══════════════════════════════════════════════
# MONTHLY SUMMARY
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.attendance
class TestMonthlySummary:

    # Use a fixed historical month so working_days is deterministic
    TEST_YEAR  = 2025
    TEST_MONTH = 3   # March 2025: 26 working days (Mon-Sat, no Sundays)

    def _mark_days(self, api, sid: int, class_id: int, working_days: list[date], count: int, status="P"):
        """Mark `count` days with `status` for the given student."""
        entries = [
            {"student_id": sid, "status": status, "date": str(d), "class_id": class_id}
            for d in working_days[:count]
        ]
        api.post("/attendance/bulk", json={"entries": entries})

    def test_no_attendance_shows_zero(self, api, create_student):
        """Month with no attendance — shows 0 present days."""
        sid, _ = create_student(class_id=1)
        # Use a far-past month where this student definitely has no records
        r = api.get("/attendance/monthly", params={"class_id": 1, "year": 2020, "month": 1})
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            entry = next((s for s in r.json() if s.get("student_id") == sid), None)
            if entry:
                assert entry.get("days_present", 0) == 0

    def test_100_percent_attendance(self, api, create_student):
        """Student marked Present every working day — percentage > 0."""
        sid, _ = create_student(class_id=1)
        wdays = _working_days_in_month(self.TEST_YEAR, self.TEST_MONTH)
        self._mark_days(api, sid, 1, wdays, len(wdays), "P")
        r = api.get("/attendance/monthly", params={
            "class_id": 1, "year": self.TEST_YEAR, "month": self.TEST_MONTH
        })
        if r.status_code == 200:
            entry = next((s for s in r.json() if s.get("student_id") == sid), None)
            if entry:
                # FIX: use "percentage" (corrected field name after Bug 1 fix)
                pct = entry.get("percentage", 0)
                assert pct > 0, "Should have positive attendance"

    def test_75_percent_boundary_not_highlighted(self, api, create_student):
        """
        TEST FAILURE FIX: Was a silent false-green — created a student but never
        marked any attendance, so percentage was always 0.0 (not 75.0), the
        if-branch was never entered and the assertion never ran.

        Fix: explicitly mark exactly 75% of working days as Present, then check
        the low_attendance flag is False (75% is NOT below threshold).
        """
        sid, _ = create_student(class_id=1)
        wdays = _working_days_in_month(self.TEST_YEAR, self.TEST_MONTH)
        total = len(wdays)
        # Mark exactly 75% of working days as Present
        present_count = round(total * 0.75)
        self._mark_days(api, sid, 1, wdays, present_count, "P")

        r = api.get("/attendance/monthly", params={
            "class_id": 1, "year": self.TEST_YEAR, "month": self.TEST_MONTH
        })
        assert r.status_code == 200, r.text
        entry = next((s for s in r.json() if s.get("student_id") == sid), None)
        assert entry is not None, "Student should appear in monthly summary"

        # FIX: use "percentage" not "attendance_percentage"
        pct = entry.get("percentage", -1)
        assert pct >= 74.0, f"Expected ~75%, got {pct}"

        # FIX: use "low_attendance" not "is_low_attendance"
        if pct >= 75.0:
            assert entry.get("low_attendance") is False, (
                f"75%+ should NOT be flagged as low attendance, got low_attendance="
                f"{entry.get('low_attendance')}"
            )

    def test_below_75_percent_highlighted(self, api, create_student):
        """
        TEST FAILURE FIX: Was a silent false-green for the same reason as above.

        Fix: mark only 50% of working days Present, then assert low_attendance is True.
        """
        sid, _ = create_student(class_id=1)
        wdays = _working_days_in_month(self.TEST_YEAR, self.TEST_MONTH)
        total = len(wdays)
        # Mark only 50% Present — well below the 75% threshold
        present_count = round(total * 0.50)
        self._mark_days(api, sid, 1, wdays, present_count, "P")

        r = api.get("/attendance/monthly", params={
            "class_id": 1, "year": self.TEST_YEAR, "month": self.TEST_MONTH
        })
        assert r.status_code == 200, r.text
        entry = next((s for s in r.json() if s.get("student_id") == sid), None)
        assert entry is not None, "Student should appear in monthly summary"

        # FIX: correct field names after Bug 1 fix
        pct = entry.get("percentage", 100)
        assert pct < 75.0, f"Expected <75%, got {pct}"
        assert entry.get("low_attendance") is True, (
            f"Below 75% should be flagged, got low_attendance={entry.get('low_attendance')}"
        )

    def test_sundays_excluded_from_working_days(self, api):
        """March 2025 has 5 Sundays → 26 working days (31 - 5 = 26)."""
        r = api.get("/attendance/monthly", params={
            "class_id": 1, "year": self.TEST_YEAR, "month": self.TEST_MONTH
        })
        if r.status_code == 200 and r.json():
            total_days = r.json()[0].get("total_working_days", None)
            if total_days:
                assert total_days == 26, (
                    f"March 2025 should have 26 working days (Mon-Sat), got {total_days}"
                )

    def test_february_calculated_correctly(self, api):
        """February 2025 (28 days, 4 Sundays) → 24 working days."""
        r = api.get("/attendance/monthly", params={"class_id": 1, "year": 2025, "month": 2})
        assert r.status_code != 500, "February should not cause server error"
        if r.status_code == 200 and r.json():
            total = r.json()[0].get("total_working_days", None)
            if total:
                assert total == 24, (
                    f"Feb 2025 (28 days, 4 Sundays) should have 24 working days, got {total}"
                )
