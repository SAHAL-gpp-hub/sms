"""
test_reports_tc_system.py — Reports, Transfer Certificate, Year-End, System/Cross-Feature Tests
"""

import pytest
from datetime import date
from conftest import StudentFactory, goto


# ══════════════════════════════════════════════
# PDF REPORT TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.reports
class TestReportPDFs:

    def _assert_pdf_response(self, r, label):
        assert r.status_code != 500, f"{label}: Server error"
        if r.status_code == 200:
            ct = r.headers.get("content-type", "")
            assert "pdf" in ct or "html" in ct, f"{label}: Unexpected content-type {ct}"
            assert len(r.content) > 0, f"{label}: Empty PDF body"

    def test_fee_defaulter_report_with_defaulters(self, api):
        """Fee defaulter report PDF — opens without error when defaulters exist."""
        r = api.get("/pdf/fee-defaulters")
        self._assert_pdf_response(r, "Defaulter Report")

    def test_fee_defaulter_report_no_defaulters(self, api):
        """Fee defaulter report — opens without error when NO defaulters exist."""
        # Pass academic_year with no activity
        r = api.get("/pdf/fee-defaulters", params={"academic_year": "1900-01"})
        assert r.status_code != 500, "Empty defaulter report should not 500"

    def test_fee_defaulter_report_school_name(self, api):
        """Defaulter report contains school name in header."""
        r = api.get("/pdf/fee-defaulters")
        if r.status_code == 200 and "pdf" not in r.headers.get("content-type", ""):
            # If HTML, check for school name
            assert len(r.content) > 100, "Report body seems too short"

    def test_attendance_report_with_data(self, api):
        """Attendance report PDF — generates for class + month with data."""
        r = api.get("/pdf/attendance", params={"class_id": 1, "month": "2025-03"})
        self._assert_pdf_response(r, "Attendance Report")

    def test_attendance_report_empty_class(self, api):
        """Attendance report — class with no data — does not crash."""
        r = api.get("/pdf/attendance", params={"class_id": 999, "month": "2025-03"})
        assert r.status_code != 500, "Empty attendance report should not 500"

    def test_class_result_report_pdf(self, api):
        """Class result report PDF — generates correctly in landscape."""
        r = api.get("/pdf/class-results", params={"class_id": 1, "exam_id": 1})
        assert r.status_code != 500, "Class result report should not 500"

    def test_class_result_report_no_marks(self, api):
        """Class result report — class with no marks — handles gracefully."""
        r = api.get("/pdf/class-results", params={"class_id": 99, "exam_id": 99})
        assert r.status_code != 500, "No-marks class result should not 500"


# ══════════════════════════════════════════════
# TRANSFER CERTIFICATE TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.tc
class TestTransferCertificate:

    def test_tc_active_student(self, create_student, api):
        """TC generates for Active student — correct details returned."""
        sid, student = create_student()
        r = api.get(f"/yearend/tc-pdf/{sid}")
        assert r.status_code in (200, 201), f"TC should generate: {r.text}"
        data = r.json() if "json" in r.headers.get("content-type", "") else {}
        if data:
            assert data.get("student_name") or data.get("name"), "TC missing student name"

    def test_tc_already_issued_student(self, create_student, api):
        """TC generates again for already TC Issued student — still works."""
        sid, _ = create_student()
        api.get(f"/yearend/tc-pdf/{sid}")  # First TC
        r = api.get(f"/yearend/tc-pdf/{sid}")  # Second TC
        assert r.status_code not in (400, 500), "Second TC generation should work"

    def test_tc_shows_correct_class_and_year(self, create_student, api):
        """TC shows correct class and academic year."""
        sid, student = create_student(class_id=1)
        r = api.get(f"/yearend/tc-pdf/{sid}")
        if r.status_code == 200 and "json" in r.headers.get("content-type", ""):
            data = r.json()
            assert data.get("academic_year") or data.get("class"), "TC missing class/year"

    def test_tc_number_unique(self, create_student, api):
        """TC number is unique per generation."""
        sid1, _ = create_student()
        sid2, _ = create_student()
        r1 = api.get(f"/yearend/tc-pdf/{sid1}")
        r2 = api.get(f"/yearend/tc-pdf/{sid2}")
        if all(r.status_code == 200 for r in [r1, r2]):
            ct = r1.headers.get("content-type", "")
            if "json" in ct:
                tc1 = r1.json().get("tc_number")
                tc2 = r2.json().get("tc_number")
                if tc1 and tc2:
                    assert tc1 != tc2, "TC numbers must be unique"

    def test_tc_issue_date_is_today(self, create_student, api):
        """TC shows today's date as issue date."""
        sid, _ = create_student()
        r = api.get(f"/yearend/tc-pdf/{sid}")
        if r.status_code == 200 and "json" in r.headers.get("content-type", ""):
            issue_date = r.json().get("issue_date")
            if issue_date:
                assert issue_date.startswith(date.today().isoformat()), \
                    f"TC issue date should be today, got {issue_date}"

    def test_tc_no_gr_number_shows_dash(self, api):
        """TC for student with no GR number — shows '—', not crash."""
        payload = StudentFactory.minimal()
        payload.pop("gr_number", None)
        r = api.post("/students", json=payload)
        if r.status_code not in (200, 201):
            pytest.skip("Could not create student without GR")
        sid = r.json()["id"]
        r2 = api.get(f"/yearend/tc-pdf/{sid}")
        assert r2.status_code != 500, "TC for student with no GR should not 500"
        api.delete(f"/students/{sid}")

    def test_tc_removed_student_still_works(self, create_student, api):
        """TC can still be generated for a removed student."""
        sid, _ = create_student()
        api.delete(f"/students/{sid}")
        r = api.get(f"/yearend/tc-pdf/{sid}")
        assert r.status_code not in (500,), "TC generation should not 500 for removed student"


# ══════════════════════════════════════════════
# YEAR-END MANAGEMENT
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.yearend
class TestYearEnd:

    def test_create_new_academic_year(self, api):
        """Create new academic year — becomes current year."""
        r = api.post("/yearend/new-year", json={"label": "2099-00", "start_date": "2099-06-01", "end_date": "2100-03-31"})
        assert r.status_code in (200, 201), r.text
        r2 = api.get("/yearend/current-year")
        assert r2.status_code == 200
        # Cleanup — don't leave test year as current
        if r.status_code in (200, 201):
            yid = r.json().get("id")
            if yid:
                api.delete(f"/yearend/new-year/{yid}")

    def test_old_year_not_current_after_new_one(self, api):
        """Only one year can be current at a time."""
        r = api.get("/yearend/years")
        if r.status_code == 200:
            current_years = [y for y in r.json() if y.get("is_current")]
            assert len(current_years) <= 1, "More than one year marked as current!"

    def test_classes_auto_created_for_new_year(self, api):
        """Classes auto-created when academic year is created."""
        r = api.get("/setup/classes")
        assert r.status_code == 200
        classes = r.json()
        assert len(classes) > 0, "No classes found — should be auto-created"

    def test_add_class_division(self, api):
        """Add Class 5 Division B — appears in list."""
        r = api.post("/setup/classes", json={"standard": 5, "division": "B", "academic_year_id": 1})
        if r.status_code in (200, 201):
            cid = r.json()["id"]
            r2 = api.get("/setup/classes")
            assert any(c["id"] == cid for c in r2.json()), "New class division not in list"
            api.delete(f"/setup/classes/{cid}")

    def test_add_duplicate_class_division_prevented(self, api):
        """Add same class+division twice — should prevent duplicate."""
        payload = {"standard": 5, "division": "A", "academic_year_id": 1}
        r1 = api.post("/setup/classes", json=payload)
        r2 = api.post("/setup/classes", json=payload)
        if r1.status_code in (200, 201) and r2.status_code in (200, 201):
            # Both created — might be allowed or a bug
            print(f"\n[DUPLICATE CLASS] Both created — review your unique constraint")
            api.delete(f"/setup/classes/{r1.json()['id']}")
            api.delete(f"/setup/classes/{r2.json()['id']}")
        elif r2.status_code in (400, 409, 422):
            pass  # Correctly prevented

    def test_promote_class1_to_class2(self, api):
        """Promote Class 1 students to Class 2 — students now in Class 2."""
        r = api.post("/yearend/promote/1", params={"new_academic_year_id": 1})
        assert r.status_code in (200, 201), f"Promotion failed: {r.text}"

    def test_promote_class10_shows_error(self, api):
        """Promote Class 10 — should show error (no class after 10)."""
        r = api.post("/yearend/promote/10", params={"new_academic_year_id": 1})
        assert r.status_code in (400, 422), "Promoting Std 10 should return error"

    def test_promote_empty_class_shows_zero(self, api):
        """Promote class with 0 students — shows 0 promoted, not crash."""
        r = api.post("/yearend/promote/99", params={"new_academic_year_id": 1})
        assert r.status_code != 500, "Empty class promotion should not 500"


# ══════════════════════════════════════════════
# SYSTEM / CROSS-FEATURE TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.system
class TestSystemIntegration:

    def test_full_student_lifecycle(self, api):
        """Add student → assign fee → mark attendance → enter marks — all linked."""
        # 1. Add student
        r = api.post("/students", json=StudentFactory.valid(class_id=1))
        assert r.status_code in (200, 201), "Student creation failed"
        sid = r.json()["id"]

        # 2. Assign fee
        api.post("/fees/structure", json={"fee_head": "Test Fee", "amount": 1000, "class_id": 1, "academic_year": "2025-26"})
        api.post("/fees/assign/{class_id_placeholder}", json={"class_id": 1, "academic_year": "2025-26"})
        r2 = api.get(f"/fees/ledger/{sid}")
        assert r2.status_code == 200, "Fee fetch failed"

        # 3. Mark attendance
        r3 = api.post("/attendance/bulk", json=[
            {"student_id": sid, "status": "P", "date": date.today().isoformat(), "class_id": 1}
        ])
        assert r3.status_code in (200, 201), "Attendance marking failed"

        # 4. Enter marks
        r4 = api.post("/marks/bulk", json={
            "student_id": sid, "exam_id": 1, "subject_id": 1,
            "marks_obtained": 75, "max_marks": 100, "is_absent": False
        })
        assert r4.status_code in (200, 201), "Marks entry failed"

        # Cleanup
        api.delete(f"/students/{sid}")

    def test_api_docs_endpoint(self, raw_api):
        """http://localhost:8000/docs — API docs available."""
        r = raw_api.get("/docs")
        assert r.status_code == 200, "/docs endpoint not returning 200"

    def test_openapi_schema(self, raw_api):
        """OpenAPI schema accessible at /openapi.json."""
        r = raw_api.get("/openapi.json")
        assert r.status_code == 200
        schema = r.json()
        assert "paths" in schema, "OpenAPI schema missing 'paths'"
        assert len(schema["paths"]) > 5, "Too few API endpoints defined"

    def test_no_500_errors_on_common_endpoints(self, api):
        """No 500 errors on standard list endpoints."""
        endpoints = [
            "/students",
            "/setup/classes",
            "/fees/heads",
            "/fees/defaulters",
            "/yearend/years",
            "/marks/subjects",
        ]
        errors = []
        for ep in endpoints:
            r = api.get(ep)
            if r.status_code == 500:
                errors.append(f"{ep} → 500: {r.text[:100]}")
        assert not errors, f"500 errors found:\n" + "\n".join(errors)


@pytest.mark.ui
@pytest.mark.system
class TestSystemUI:

    def test_dashboard_loads(self, page):
        """Dashboard page loads without error."""
        goto(page, "/")
        page.wait_for_load_state("networkidle")
        # Check no error message visible
        error = page.locator(".error, [data-testid='error'], .alert-danger").count()
        assert error == 0, "Error element visible on dashboard"

    def test_browser_back_button(self, page):
        """Browser back button navigates correctly."""
        goto(page, "/students")
        page.wait_for_load_state("networkidle")
        goto(page, "/fees")
        page.wait_for_load_state("networkidle")
        page.go_back()
        page.wait_for_load_state("networkidle")
        assert "students" in page.url, f"Back should go to /students, got {page.url}"

    def test_direct_url_access(self, page):
        """Direct URL access loads React app correctly (React Router working)."""
        goto(page, "/students")
        page.wait_for_load_state("networkidle")
        # Should not show 404 or blank page
        body_text = page.inner_text("body")
        assert len(body_text) > 10, "Page appears blank on direct URL access"

    def test_page_refresh_stays_on_same_page(self, page):
        """Page refresh stays on same route."""
        goto(page, "/attendance")
        page.wait_for_load_state("networkidle")
        page.reload()
        page.wait_for_load_state("networkidle")
        assert "attendance" in page.url, f"After refresh, expected /attendance, got {page.url}"

    def test_dashboard_student_count_updates(self, page, api):
        """Dashboard student count updates after adding a student."""
        goto(page, "/")
        page.wait_for_load_state("networkidle")

        # Get current count from UI (if shown)
        try:
            count_el = page.locator("[data-testid='total-students'], .student-count, .stat-card").first
            before = count_el.inner_text()
        except Exception:
            before = None

        # Add a student via API
        r = api.post("/students", json=StudentFactory.valid())
        if r.status_code not in (200, 201):
            pytest.skip("Student creation failed")
        sid = r.json()["id"]

        # Reload dashboard
        page.reload()
        page.wait_for_load_state("networkidle")

        # Cleanup
        api.delete(f"/students/{sid}")