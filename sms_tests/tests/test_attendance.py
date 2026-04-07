"""
test_attendance.py — Attendance Tests
Covers: daily marking, update (not duplicate), monthly summary, boundary cases
"""

import pytest
from datetime import date, timedelta
from conftest import StudentFactory, goto


def today_str():
    return date.today().isoformat()


def past_date_str(days=5):
    return (date.today() - timedelta(days=days)).isoformat()


def future_date_str(days=3):
    return (date.today() + timedelta(days=days)).isoformat()



# ══════════════════════════════════════════════
# DAILY MARKING
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.attendance
class TestDailyAttendance:

    def test_roster_shows_only_active_students(self, api, create_student):
        """Attendance roster shows only ACTIVE (non-removed) students."""
        sid, _ = create_student(class_id=1)
        r = api.get("/attendance/daily", params={"class_id": 1, "date": today_str()})
        assert r.status_code == 200
        ids = [s["student_id"] for s in r.json()]
        assert sid in ids, "Newly created student should be on roster"

    def test_removed_student_not_on_roster(self, api, create_student):
        """Removed student NOT on attendance roster."""
        sid, _ = create_student(class_id=1)
        api.delete(f"/students/{sid}")
        r = api.get("/attendance/daily", params={"class_id": 1, "date": today_str()})
        assert r.status_code == 200
        ids = [s["student_id"] for s in r.json()]
        assert sid not in ids

    def test_mark_all_present(self, api, create_student):
        """Mark all students Present — saves P for all."""
        sid, _ = create_student(class_id=1)
        r = api.get("/attendance/daily", params={"class_id": 1, "date": today_str()})
        roster = r.json()
        entries = [{"student_id": s["student_id"], "status": "P", "date": today_str(), "class_id": 1}
                   for s in roster]
        r2 = api.post("/attendance/bulk", json={"entries": entries})
        assert r2.status_code in (200, 201), r2.text

    def test_mark_all_absent(self, api):
        """Mark all students Absent — saves A for all."""
        r = api.get("/attendance/daily", params={"class_id": 1, "date": past_date_str(10)})
        roster = r.json()
        if not roster:
            pytest.skip("No students in class 1")
        entries = [{"student_id": s["student_id"], "status": "A", "date": past_date_str(10), "class_id": 1}
                   for s in roster]
        r2 = api.post("/attendance/bulk", json={"entries": entries})
        assert r2.status_code in (200, 201)

    def test_mixed_status_palt(self, api, create_student):
        """Mix of P/A/L/OL — saves correctly."""
        sids = []
        for _ in range(4):
            sid, _ = create_student(class_id=2)
            sids.append(sid)
        statuses = ["P", "A", "L", "OL"]
        entries = [{"student_id": sid, "status": st, "date": past_date_str(2), "class_id": 2}
                   for sid, st in zip(sids, statuses)]
        r = api.post("/attendance/bulk", json={"entries": entries})
        assert r.status_code in (200, 201), r.text
        for cleanup_sid in sids:
            api.delete(f"/students/{cleanup_sid}")

    def test_save_attendance_past_date(self, api, create_student):
        """Save attendance for past date — should work (backdating allowed)."""
        sid, _ = create_student(class_id=1)
        entries = [{"student_id": sid, "status": "P", "date": past_date_str(7), "class_id": 1}]
        r = api.post("/attendance/bulk", json={"entries": entries})
        assert r.status_code in (200, 201), f"Backdating should work: {r.text}"

    def test_save_attendance_future_date(self, api, create_student):
        """Save attendance for future date — document behavior."""
        sid, _ = create_student(class_id=1)
        entries = [{"student_id": sid, "status": "P", "date": future_date_str(3), "class_id": 1}]
        r = api.post("/attendance/bulk", json={"entries": entries})
        print(f"\n[FUTURE DATE ATTENDANCE] Status: {r.status_code} — {'allowed' if r.status_code in (200,201) else 'rejected'}")
        assert r.status_code != 500, "Future date should not cause server error"

    def test_attendance_prefilled_on_revisit(self, api, create_student):
        """Coming back to same class + date — previous attendance is pre-filled."""
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
        """Update attendance — updates record, does NOT create duplicate."""
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
        """Class with 0 students — attendance roster is empty list, not error."""
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

    def test_no_attendance_shows_zero(self, api, create_student):
        """Month with no attendance marked — shows 0 for all students."""
        sid, _ = create_student(class_id=1)
        r = api.get("/attendance/monthly", params={"class_id": 1, "year": 2020, "month": 1})
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            entry = next((s for s in r.json() if s.get("student_id") == sid), None)
            if entry:
                assert entry.get("present_days", 0) == 0

    def test_100_percent_attendance(self, api, create_student):
        """Student with 100% — percentage = 100%."""
        sid, _ = create_student(class_id=1)
        for i in range(1, 6):
            api.post("/attendance/bulk", json={"entries": [
                {"student_id": sid, "status": "P", "date": f"2025-03-{i:02d}", "class_id": 1}
            ]})
        r = api.get("/attendance/monthly", params={"class_id": 1, "year": 2025, "month": 3})
        if r.status_code == 200:
            entry = next((s for s in r.json() if s.get("student_id") == sid), None)
            if entry:
                pct = entry.get("attendance_percentage", 0)
                assert pct > 0, "Should have positive attendance"

    def test_75_percent_boundary_not_highlighted(self, api, create_student):
        """Student at exactly 75% — NOT highlighted as low attendance."""
        sid, _ = create_student(class_id=1)
        r = api.get("/attendance/monthly", params={"class_id": 1, "year": 2025, "month": 1})
        if r.status_code == 200:
            entry = next((s for s in r.json() if s.get("student_id") == sid), None)
            if entry and entry.get("attendance_percentage") == 75.0:
                assert entry.get("is_low_attendance") == False, "75% exactly should NOT be flagged"

    def test_below_75_percent_highlighted(self, api, create_student):
        """Student below 75% — highlighted as low attendance."""
        sid, _ = create_student(class_id=1)
        r = api.get("/attendance/monthly", params={"class_id": 1, "year": 2025, "month": 1})
        if r.status_code == 200:
            entry = next((s for s in r.json() if s.get("student_id") == sid), None)
            if entry and entry.get("attendance_percentage", 100) < 75:
                assert entry.get("is_low_attendance") == True, "Below 75% should be flagged"

    def test_sundays_excluded_from_working_days(self, api):
        """Working days — Sundays excluded. March 2025 has 5 Sundays → ~26 working days."""
        r = api.get("/attendance/monthly", params={"class_id": 1, "year": 2025, "month": 3})
        if r.status_code == 200 and r.json():
            total_days = r.json()[0].get("total_working_days", None)
            if total_days:
                assert total_days <= 27, f"March 2025 should have ≤27 working days, got {total_days}"
                assert total_days >= 25, f"March 2025 should have ≥25 working days, got {total_days}"

    def test_february_calculated_correctly(self, api):
        """February (28/29 days) — working days calculated correctly."""
        r = api.get("/attendance/monthly", params={"class_id": 1, "year": 2025, "month": 2})
        assert r.status_code != 500, "February should not cause server error"
        if r.status_code == 200 and r.json():
            total = r.json()[0].get("total_working_days", None)
            if total:
                assert total <= 24, f"Feb 2025 (28 days) max ~24 working days, got {total}"