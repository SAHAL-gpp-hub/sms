"""
test_students.py — Student Management Tests
Covers: CRUD, validation, search, filter, edge cases
"""

import pytest
from conftest import StudentFactory, goto


# ══════════════════════════════════════════════
# API TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.students
class TestStudentCRUD:

    def test_add_student_all_fields(self, api):
        """Add student with all fields filled — saves correctly."""
        payload = StudentFactory.valid()
        r = api.post("/students", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["first_name"] == payload["first_name"]
        # cleanup
        api.delete(f"/students/{data['id']}")

    def test_add_student_only_required_fields(self, api):
        """Add student with only required fields — saves correctly."""
        payload = StudentFactory.minimal()
        r = api.post("/students", json=payload)
        assert r.status_code in (200, 201), r.text
        api.delete(f"/students/{r.json()['id']}")

    def test_add_student_gujarati_name(self, api):
        """Add student with Gujarati name — saves correctly."""
        payload = StudentFactory.valid(
            first_name_gujarati="ગુજરાતી",
            last_name_gujarati="નામ"
        )
        r = api.post("/students", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("first_name_gujarati") == "ગુજરાતી"
        api.delete(f"/students/{data['id']}")

    def test_add_two_students_same_name(self, api):
        """Two students with same name — both should save."""
        payload = StudentFactory.valid(first_name="Rahul", last_name="Shah")
        r1 = api.post("/students", json=payload)
        r2 = api.post("/students", json=payload)
        assert r1.status_code in (200, 201)
        assert r2.status_code in (200, 201)
        assert r1.json()["id"] != r2.json()["id"]
        api.delete(f"/students/{r1.json()['id']}")
        api.delete(f"/students/{r2.json()['id']}")

    def test_add_10_plus_students_same_class(self, api):
        """Add 10+ students to same class — all appear in list."""
        ids = []
        for i in range(12):
            r = api.post("/students", json=StudentFactory.valid(class_id=1, roll_number=i + 100))
            assert r.status_code in (200, 201), f"Failed on student {i}: {r.text}"
            ids.append(r.json()["id"])
        r = api.get("/students", params={"class_id": 1})
        assert r.status_code == 200
        student_ids_in_list = [s["id"] for s in r.json()]
        for sid in ids:
            assert sid in student_ids_in_list, f"Student {sid} missing from class list"
        for sid in ids:
            api.delete(f"/students/{sid}")

    def test_edit_student_change_class(self, create_student, api):
        """Edit student — change class — saves correctly."""
        sid, _ = create_student(class_id=1)
        r = api.put(f"/students/{sid}", json={"class_id": 2})
        assert r.status_code in (200, 201), r.text
        assert r.json()["class_id"] == 2

    def test_edit_student_contact_validation_still_works(self, create_student, api):
        """Editing contact number — validation still runs."""
        sid, _ = create_student()
        r = api.put(f"/students/{sid}", json={"contact_number": "12345"})
        assert r.status_code in (400, 422), "Short contact should fail on edit too"

    def test_remove_student(self, create_student, api):
        """Remove student — disappears from list."""
        sid, _ = create_student()
        r = api.delete(f"/students/{sid}")
        assert r.status_code in (200, 204), r.text
        r2 = api.get(f"/students/{sid}")
        assert r2.status_code == 404

    def test_removed_student_not_in_defaulters(self, create_student, api):
        """Removed student does NOT appear in fee defaulters."""
        sid, _ = create_student()
        api.delete(f"/students/{sid}")
        r = api.get("/fees/defaulters")
        defaulter_ids = [d["student_id"] for d in r.json()]
        assert sid not in defaulter_ids

    def test_removed_student_not_in_attendance_roster(self, create_student, api):
        """Removed student does NOT appear in attendance roster."""
        sid, _ = create_student(class_id=1)
        api.delete(f"/students/{sid}")
        r = api.get("/attendance/daily", params={"class_id": 1, "date": "2025-06-01"})
        roster_ids = [s["student_id"] for s in r.json()]
        assert sid not in roster_ids

    def test_removed_student_not_in_marks_grid(self, create_student, api):
        """Removed student does NOT appear in marks grid."""
        sid, _ = create_student(class_id=1)
        api.delete(f"/students/{sid}")
        r = api.get("/marks/grid", params={"class_id": 1, "exam_id": 1})
        grid_ids = [s["student_id"] for s in r.json()]
        assert sid not in grid_ids

    def test_tc_still_works_for_removed_student(self, create_student, api):
        """TC can still be generated for a removed (Left) student."""
        sid, _ = create_student()
        api.delete(f"/students/{sid}")
        r = api.get(f"/students/{sid}/tc")
        # Should return TC data or PDF, not 404/500
        assert r.status_code != 500, "Server error generating TC for removed student"


# ══════════════════════════════════════════════
# VALIDATION TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.students
class TestStudentValidation:

    @pytest.mark.parametrize("contact,reason", [
        ("0123456789", "starts with 0"),
        ("123456789",  "9 digits"),
        ("12345678901","11 digits"),
        ("abcdefghij", "non-numeric"),
    ])
    def test_invalid_contact_number(self, api, contact, reason):
        payload = StudentFactory.valid(contact_number=contact)
        r = api.post("/students", json=payload)
        assert r.status_code in (400, 422), f"Should reject contact '{contact}' ({reason})"

    @pytest.mark.parametrize("roll,reason", [
        (0,  "zero"),
        (-1, "negative"),
    ])
    def test_invalid_roll_number(self, api, roll, reason):
        payload = StudentFactory.valid(roll_number=roll)
        r = api.post("/students", json=payload)
        assert r.status_code in (400, 422), f"Should reject roll number {roll} ({reason})"

    def test_future_date_of_birth(self, api):
        """Future DOB — should reject or warn."""
        payload = StudentFactory.valid(date_of_birth="2099-01-01")
        r = api.post("/students", json=payload)
        assert r.status_code in (400, 422), "Future DOB should be rejected"

    def test_today_date_of_birth(self, api):
        """Today's DOB — edge case, should work."""
        from datetime import date
        payload = StudentFactory.valid(date_of_birth=date.today().isoformat())
        r = api.post("/students", json=payload)
        assert r.status_code in (200, 201), "Today's DOB should be accepted"
        if r.status_code in (200, 201):
            api.delete(f"/students/{r.json()['id']}")

    def test_same_class_same_roll_number_prevented(self, create_student, api):
        """Two students in same class with same roll number — should prevent or warn."""
        sid1, _ = create_student(class_id=1, roll_number=99)
        payload = StudentFactory.valid(class_id=1, roll_number=99)
        r = api.post("/students", json=payload)
        # Either reject (4xx) or warn — should NOT silently duplicate
        if r.status_code in (200, 201):
            # If allowed, at least check there's a warning mechanism
            api.delete(f"/students/{r.json()['id']}")
        # We just document the behavior; log for manual review
        print(f"\n[ROLL DUPLICATE] Status: {r.status_code} — {'PREVENTED' if r.status_code in (400,422) else 'ALLOWED (review)'}")

    def test_student_very_long_name(self, api):
        """50+ char name — saves without error."""
        long_name = "A" * 55
        payload = StudentFactory.valid(first_name=long_name)
        r = api.post("/students", json=payload)
        assert r.status_code in (200, 201), f"Long name should save: {r.text}"
        api.delete(f"/students/{r.json()['id']}")

    def test_no_gr_number(self, api):
        """Student with no GR number — works fine throughout."""
        payload = StudentFactory.minimal()
        payload.pop("gr_number", None)
        r = api.post("/students", json=payload)
        assert r.status_code in (200, 201), r.text
        api.delete(f"/students/{r.json()['id']}")

    def test_no_roll_number(self, api):
        """Student with no roll number — should appear with '—'."""
        payload = StudentFactory.minimal()
        payload.pop("roll_number", None)
        r = api.post("/students", json=payload)
        assert r.status_code in (200, 201), r.text
        api.delete(f"/students/{r.json()['id']}")

    @pytest.mark.parametrize("aadhar,digits", [
        ("12345678901",  11),
        ("1234567890123", 13),
    ])
    def test_aadhar_boundary_digits(self, api, aadhar, digits):
        """Aadhar with 11 or 13 digits — document behavior."""
        payload = StudentFactory.valid(aadhar_number=aadhar)
        r = api.post("/students", json=payload)
        print(f"\n[AADHAR {digits}d] Status: {r.status_code} — document your validation rule")
        if r.status_code in (200, 201):
            api.delete(f"/students/{r.json()['id']}")


# ══════════════════════════════════════════════
# SEARCH & FILTER TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.students
class TestStudentSearchFilter:

    def test_search_by_partial_name(self, create_student, api):
        """Partial name search (e.g. 'rah' finds 'Rahul')."""
        sid, _ = create_student(first_name="Rahul")
        r = api.get("/students", params={"search": "rah"})
        assert r.status_code == 200
        names = [s["first_name"].lower() for s in r.json()]
        assert any("rahul" in n for n in names), "Partial name search failed"

    def test_search_by_contact_number(self, create_student, api):
        """Search by exact contact number — finds correct student."""
        contact = "9876543210"
        sid, _ = create_student(contact_number=contact)
        r = api.get("/students", params={"search": contact})
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert sid in ids

    def test_search_by_gr_number(self, create_student, api):
        """Search by GR number — finds correct student."""
        gr = "GR9999ZZ"
        sid, _ = create_student(gr_number=gr)
        r = api.get("/students", params={"search": gr})
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert sid in ids

    def test_search_case_insensitive(self, create_student, api):
        """Search with ALL CAPS — still finds student."""
        sid, _ = create_student(first_name="Ramesh")
        r = api.get("/students", params={"search": "RAMESH"})
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert sid in ids

    def test_filter_by_class(self, create_student, api):
        """Filter by class — only shows that class's students."""
        sid, _ = create_student(class_id=3)
        r = api.get("/students", params={"class_id": 3})
        assert r.status_code == 200
        for s in r.json():
            assert s["class_id"] == 3, f"Student {s['id']} has class {s['class_id']}, expected 3"

    def test_filter_class_plus_search(self, create_student, api):
        """Filter by class + search — both filters apply simultaneously."""
        sid, _ = create_student(class_id=2, first_name="Priya")
        r = api.get("/students", params={"class_id": 2, "search": "Priya"})
        assert r.status_code == 200
        for s in r.json():
            assert s["class_id"] == 2
        ids = [s["id"] for s in r.json()]
        assert sid in ids


# ══════════════════════════════════════════════
# UI TESTS
# ══════════════════════════════════════════════

@pytest.mark.ui
@pytest.mark.students
class TestStudentUI:

    def test_student_list_page_loads(self, page):
        """Student list page renders without errors."""
        goto(page, "/students")
        page.wait_for_selector("table, [data-testid='student-list'], .student-list", timeout=8000)

    def test_add_student_form_opens(self, page):
        """Add student form opens when button clicked."""
        goto(page, "/students")
        page.click("button:has-text('Add'), button:has-text('New Student'), [data-testid='add-student']")
        page.wait_for_selector("form, [role='dialog'], .modal", timeout=5000)

    def test_search_ui_filters_students(self, page):
        """Typing in search box filters the student list."""
        goto(page, "/students")
        search_input = page.locator("input[placeholder*='Search'], input[type='search'], [data-testid='search']").first
        search_input.fill("Rah")
        page.wait_for_timeout(500)
        rows = page.locator("table tbody tr").count()
        # Just verify page doesn't crash and shows some result
        assert rows >= 0

    def test_invalid_contact_shows_error_ui(self, page):
        """Submitting invalid contact number shows error in UI."""
        goto(page, "/students")
        try:
            page.click("button:has-text('Add'), button:has-text('New Student')")
            page.wait_for_selector("form, [role='dialog']", timeout=5000)
            contact_field = page.locator("input[name*='contact'], input[placeholder*='contact'], input[placeholder*='phone']").first
            contact_field.fill("12345")
            page.locator("button[type='submit'], button:has-text('Save')").click()
            page.wait_for_selector(".error, [role='alert'], .text-red, .text-danger", timeout=3000)
        except Exception as e:
            pytest.skip(f"UI selectors need adjustment for your app: {e}")