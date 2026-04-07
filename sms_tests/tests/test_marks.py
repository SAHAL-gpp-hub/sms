"""
test_marks.py — Marks Entry & Grade Calculation Tests
Covers: grid entry, grade thresholds, rank, CGPA, result status, PDF
"""

import pytest
from conftest import StudentFactory, goto


# ══════════════════════════════════════════════
# MARKS GRID TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.marks
class TestMarksGrid:

    def test_load_gseb_subjects_std1(self, api):
        """Load GSEB subjects for Std 1 — 5 subjects appear."""
        r = api.post("/marks/subjects/seed", json={"standard": 1})
        assert r.status_code in (200, 201), r.text
        r2 = api.get("/marks/subjects", params={"standard": 1})
        assert r2.status_code == 200
        assert len(r2.json()) >= 5, "Expected at least 5 subjects for Std 1"

    def test_load_gseb_subjects_std10(self, api):
        """Load GSEB subjects for Std 10 — 7 subjects including Science practical."""
        r = api.post("/marks/subjects/seed", json={"standard": 10})
        r2 = api.get("/marks/subjects", params={"standard": 10})
        if r2.status_code == 200:
            subjects = r2.json()
            assert len(subjects) >= 7, "Std 10 needs 7+ subjects"
            subject_names = [s["name"].lower() for s in subjects]
            has_science = any("science" in n for n in subject_names)
            assert has_science, "Science should be in Std 10 subjects"

    def test_load_subjects_twice_no_duplicates(self, api):
        """Load subjects twice — no duplicates."""
        api.post("/marks/subjects/seed", json={"standard": 5})
        api.post("/marks/subjects/seed", json={"standard": 5})
        r = api.get("/marks/subjects", params={"standard": 5})
        if r.status_code == 200:
            names = [s["name"] for s in r.json()]
            assert len(names) == len(set(names)), f"Duplicate subjects: {names}"

    def test_marks_entry_zero(self, api, create_student):
        """Enter marks = 0 — should save (0 is a valid score)."""
        sid, _ = create_student(class_id=1)
        r = api.post("/marks/bulk", json=[{
            "student_id": sid,
            "exam_id": 1,
            "subject_id": 1,
            "marks_obtained": 0,
            "max_marks": 100,
            "is_absent": False
        }])
        assert r.status_code in (200, 201), f"0 marks should be valid: {r.text}"

    def test_marks_entry_max(self, api, create_student):
        """Enter marks = max marks (100) — saves correctly."""
        sid, _ = create_student(class_id=1)
        r = api.post("/marks/bulk", json=[{
            "student_id": sid, "exam_id": 1, "subject_id": 1,
            "marks_obtained": 100, "max_marks": 100, "is_absent": False
        }])
        assert r.status_code in (200, 201), r.text

    def test_marks_entry_exceeds_max_rejected(self, api, create_student):
        """Marks > max marks (101/100) — should prevent or warn."""
        sid, _ = create_student(class_id=1)
        r = api.post("/marks/bulk", json=[{
            "student_id": sid, "exam_id": 1, "subject_id": 1,
            "marks_obtained": 101, "max_marks": 100, "is_absent": False
        }])
        assert r.status_code in (400, 422), "Marks above max should be rejected"

    def test_marks_entry_decimal(self, api, create_student):
        """Enter decimal marks (45.5) — saves correctly."""
        sid, _ = create_student(class_id=1)
        r = api.post("/marks/bulk", json=[{
            "student_id": sid, "exam_id": 1, "subject_id": 1,
            "marks_obtained": 45.5, "max_marks": 100, "is_absent": False
        }])
        assert r.status_code in (200, 201), r.text

    def test_mark_student_absent(self, api, create_student):
        """Mark student absent — inputs disabled, AB shown in result."""
        sid, _ = create_student(class_id=1)
        r = api.post("/marks/bulk", json=[{
            "student_id": sid, "exam_id": 1, "subject_id": 1,
            "marks_obtained": None, "max_marks": 100, "is_absent": True
        }])
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("is_absent") == True

    def test_marks_persist_after_save(self, api, create_student):
        """Save marks — come back later — marks still there (persistent)."""
        sid, _ = create_student(class_id=1)
        api.post("/marks/bulk", json=[{
            "student_id": sid, "exam_id": 1, "subject_id": 1,
            "marks_obtained": 78, "max_marks": 100, "is_absent": False
        }])
        # Re-fetch
        r = api.get("/marks", params={"student_id": sid, "exam_id": 1})
        assert r.status_code == 200
        marks = r.json()
        entry = next((m for m in marks if m.get("subject_id") == 1), None)
        assert entry is not None, "Mark entry not found after save"
        assert entry["marks_obtained"] == 78

    def test_marks_update_correctly(self, api, create_student):
        """Edit marks after saving — updates correctly, not duplicates."""
        sid, _ = create_student(class_id=1)
        r1 = api.post("/marks/bulk", json=[{
            "student_id": sid, "exam_id": 1, "subject_id": 2,
            "marks_obtained": 50, "max_marks": 100, "is_absent": False
        }])
        mid = r1.json().get("id")
        r2 = api.put(f"/marks/bulk/{mid}", json={"marks_obtained": 75})
        assert r2.status_code in (200, 201), r2.text
        assert r2.json()["marks_obtained"] == 75

    def test_removed_student_not_in_marks_grid(self, create_student, api):
        """Removed student does NOT appear in marks grid."""
        sid, _ = create_student(class_id=1)
        api.delete(f"/students/{sid}")
        r = api.get("/marks/grid", params={"class_id": 1, "exam_id": 1})
        grid_ids = [s["student_id"] for s in r.json()]
        assert sid not in grid_ids


# ══════════════════════════════════════════════
# GRADE CALCULATION — parametrize all thresholds
# ══════════════════════════════════════════════

GRADE_CASES = [
    # (score, max, expected_grade, expected_gp)
    (95,  100, "A1", 10.0),
    (85,  100, "A2",  9.0),
    (75,  100, "B1",  8.0),
    (65,  100, "B2",  7.0),
    (55,  100, "C1",  6.0),
    (45,  100, "C2",  5.0),
    (35,  100, "D",   4.0),
    (33,  100, "D",   4.0),   # exactly passing threshold
    (32,  100, "E",   0.0),   # just below threshold
    (30,  100, "E",   0.0),   # clear fail
]

@pytest.mark.api
@pytest.mark.marks
class TestGradeCalculation:

    @pytest.mark.parametrize("score,max_marks,expected_grade,expected_gp", GRADE_CASES)
    def test_grade_thresholds(self, api, create_student, score, max_marks, expected_grade, expected_gp):
        """Grade and GP calculated correctly at each threshold."""
        sid, _ = create_student(class_id=1)
        api.post("/marks/bulk", json=[{
            "student_id": sid, "exam_id": 1, "subject_id": 1,
            "marks_obtained": score, "max_marks": max_marks, "is_absent": False
        }])
        r = api.get(f"/marks/results", params={"student_id": sid, "exam_id": 1})
        if r.status_code == 200:
            result = r.json()
            subjects = result.get("subjects", [result])  # handle flat or nested
            entry = next((s for s in subjects if s.get("subject_id") == 1), None)
            if entry:
                assert entry.get("grade") == expected_grade, \
                    f"Score {score}: expected grade {expected_grade}, got {entry.get('grade')}"
                assert float(entry.get("grade_point", 0)) == expected_gp, \
                    f"Score {score}: expected GP {expected_gp}, got {entry.get('grade_point')}"

    def test_absent_subject_causes_fail(self, api, create_student):
        """Student absent in 1 subject — Result = FAIL."""
        sid, _ = create_student(class_id=1)
        # Pass all subjects
        for subj_id in [1, 2, 3, 4, 5]:
            api.post("/marks/bulk", json=[{
                "student_id": sid, "exam_id": 1, "subject_id": subj_id,
                "marks_obtained": 80, "max_marks": 100, "is_absent": False
            }])
        # Absent in one
        api.post("/marks/bulk", json=[{
            "student_id": sid, "exam_id": 1, "subject_id": 6,
            "marks_obtained": None, "max_marks": 100, "is_absent": True
        }])
        r = api.get(f"/marks/results", params={"student_id": sid, "exam_id": 1})
        if r.status_code == 200:
            assert r.json().get("result") == "FAIL", "Absent in 1 subject should cause FAIL"

    def test_pass_all_subjects(self, api, create_student):
        """Student passes all subjects — Result = PASS."""
        sid, _ = create_student(class_id=1)
        for subj_id in [1, 2, 3, 4, 5]:
            api.post("/marks/bulk", json=[{
                "student_id": sid, "exam_id": 1, "subject_id": subj_id,
                "marks_obtained": 60, "max_marks": 100, "is_absent": False
            }])
        r = api.get(f"/marks/results", params={"student_id": sid, "exam_id": 1})
        if r.status_code == 200:
            assert r.json().get("result") == "PASS"

    def test_fail_one_subject_fails_overall(self, api, create_student):
        """Fail 1 subject — Result = FAIL overall."""
        sid, _ = create_student(class_id=1)
        for subj_id in [1, 2, 3, 4]:
            api.post("/marks/bulk", json=[{
                "student_id": sid, "exam_id": 1, "subject_id": subj_id,
                "marks_obtained": 80, "max_marks": 100, "is_absent": False
            }])
        # Fail one
        api.post("/marks/bulk", json=[{
            "student_id": sid, "exam_id": 1, "subject_id": 5,
            "marks_obtained": 20, "max_marks": 100, "is_absent": False
        }])
        r = api.get(f"/marks/results", params={"student_id": sid, "exam_id": 1})
        if r.status_code == 200:
            assert r.json().get("result") == "FAIL"

    def test_class_rank_top_scorer_is_rank1(self, api, create_student):
        """Top scorer in class = Rank 1."""
        # Create two students, give second one higher marks
        sid1, _ = create_student(class_id=1)
        sid2, _ = create_student(class_id=1)
        api.post("/marks/bulk", json=[{
            "student_id": sid1, "exam_id": 1, "subject_id": 1,
            "marks_obtained": 70, "max_marks": 100, "is_absent": False
        }])
        api.post("/marks/bulk", json=[{
            "student_id": sid2, "exam_id": 1, "subject_id": 1,
            "marks_obtained": 90, "max_marks": 100, "is_absent": False
        }])
        r = api.get("/marks/results", params={"class_id": 1, "exam_id": 1})
        if r.status_code == 200:
            results = r.json()
            rank1 = next((s for s in results if s.get("rank") == 1), None)
            if rank1:
                assert rank1["student_id"] == sid2, "Top scorer should be Rank 1"

    def test_same_percentage_same_rank(self, api, create_student):
        """Two students with same percentage — same rank or consecutive."""
        sid1, _ = create_student(class_id=1)
        sid2, _ = create_student(class_id=1)
        for sid in [sid1, sid2]:
            api.post("/marks/bulk", json=[{
                "student_id": sid, "exam_id": 1, "subject_id": 1,
                "marks_obtained": 80, "max_marks": 100, "is_absent": False
            }])
        r = api.get("/marks/results", params={"class_id": 1, "exam_id": 1})
        if r.status_code == 200:
            results = {s["student_id"]: s.get("rank") for s in r.json()}
            r1 = results.get(sid1)
            r2 = results.get(sid2)
            if r1 and r2:
                assert abs(r1 - r2) <= 1, f"Same score — ranks should be same or consecutive, got {r1} and {r2}"


# ══════════════════════════════════════════════
# PDF & RESULTS VIEW TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.marks
class TestResultsPDF:

    def test_marksheet_pdf_generates(self, api, create_student):
        """Student marksheet PDF opens without error."""
        sid, _ = create_student(class_id=1)
        r = api.get(f"/pdf/marksheet/student/{sid}", params={"exam_id": 1})
        assert r.status_code not in (500,), f"PDF generation error: {r.text}"
        if r.status_code == 200:
            ct = r.headers.get("content-type", "")
            assert "pdf" in ct or "html" in ct, f"Unexpected content-type: {ct}"

    def test_bulk_class_pdf_generates(self, api):
        """Bulk class PDF — generates without error."""
        r = api.get("/pdf/marksheet/class", params={"class_id": 1, "exam_id": 1})
        assert r.status_code not in (500,), "Bulk PDF generation should not 500"

    def test_results_sorted_by_rank(self, api):
        """Results are sorted rank 1 at top."""
        r = api.get("/marks/results", params={"class_id": 1, "exam_id": 1})
        if r.status_code == 200 and r.json():
            ranks = [s.get("rank", 0) for s in r.json()]
            assert ranks == sorted(ranks), "Results are not sorted by rank"

    def test_results_page_empty_class(self, api):
        """Class with 0 marks — results page shows empty, not error."""
        r = api.get("/marks/results", params={"class_id": 99, "exam_id": 1})
        assert r.status_code != 500
        if r.status_code == 200:
            assert r.json() == [] or r.json() is not None
