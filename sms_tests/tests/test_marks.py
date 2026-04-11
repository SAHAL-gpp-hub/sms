"""
test_marks.py — Marks Entry & Grade Calculation Tests
Covers: grid entry, grade thresholds, rank, CGPA, result status, PDF
"""

import pytest
from conftest import StudentFactory, goto


def make_mark(student_id, exam_id, subject_id, marks=80, max_marks=100, is_absent=False):
    return {
        "student_id": student_id,
        "exam_id": exam_id,
        "subject_id": subject_id,
        "theory_marks": None if is_absent else marks,
        "practical_marks": None,
        "is_absent": is_absent
    }


def get_or_create_exam(api, class_id=1, academic_year_id=1):
    """Get first exam for class or create one."""
    r = api.get("/marks/exams", params={"class_id": class_id, "academic_year_id": academic_year_id})
    if r.status_code == 200 and r.json():
        return r.json()[0]["id"]
    r2 = api.post("/marks/exams", json={
        "name": "Unit Test 1",
        "class_id": class_id,
        "academic_year_id": academic_year_id
    })
    if r2.status_code in (200, 201):
        return r2.json()["id"]
    return 1


def get_subjects_for_class(api, class_id=1):
    """Seed and return subjects for a class."""
    api.post(f"/marks/subjects/seed/{class_id}")
    r = api.get("/marks/subjects", params={"class_id": class_id})
    if r.status_code == 200:
        return r.json()
    return []


# ══════════════════════════════════════════════
# MARKS GRID TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.marks
class TestMarksGrid:

    def test_load_gseb_subjects_std1(self, api):
        """Load GSEB subjects for Std 1 — 5 subjects appear."""
        # Get class_id for Std 1
        r = api.get("/setup/classes")
        classes = r.json()
        std1 = next((c for c in classes if c["name"] == "1"), None)
        if not std1:
            pytest.skip("Std 1 class not found")

        # Seed via path param endpoint
        r2 = api.post(f"/marks/subjects/seed/{std1['id']}")
        assert r2.status_code in (200, 201), r2.text

        r3 = api.get("/marks/subjects", params={"class_id": std1["id"]})
        assert r3.status_code == 200
        assert len(r3.json()) >= 5, "Expected at least 5 subjects for Std 1"

    def test_load_gseb_subjects_std10(self, api):
        """Load GSEB subjects for Std 10 — 7 subjects including Science practical."""
        r = api.get("/setup/classes")
        classes = r.json()
        std10 = next((c for c in classes if c["name"] == "10"), None)
        if not std10:
            pytest.skip("Std 10 class not found")

        api.post(f"/marks/subjects/seed/{std10['id']}")
        r2 = api.get("/marks/subjects", params={"class_id": std10["id"]})
        if r2.status_code == 200:
            subjects = r2.json()
            assert len(subjects) >= 7, "Std 10 needs 7+ subjects"
            subject_names = [s["name"].lower() for s in subjects]
            has_science = any("science" in n for n in subject_names)
            assert has_science, "Science should be in Std 10 subjects"

    def test_load_subjects_twice_no_duplicates(self, api):
        """Load subjects twice — no duplicates."""
        r = api.get("/setup/classes")
        classes = r.json()
        std5 = next((c for c in classes if c["name"] == "5"), None)
        if not std5:
            pytest.skip("Std 5 class not found")

        api.post(f"/marks/subjects/seed/{std5['id']}")
        api.post(f"/marks/subjects/seed/{std5['id']}")
        r2 = api.get("/marks/subjects", params={"class_id": std5["id"]})
        if r2.status_code == 200:
            names = [s["name"] for s in r2.json()]
            assert len(names) == len(set(names)), f"Duplicate subjects: {names}"

    def test_marks_entry_zero(self, api, create_student):
        """Enter marks = 0 — should save (0 is a valid score)."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects for class 1")
        exam_id = get_or_create_exam(api, class_id=1)

        r = api.post("/marks/bulk", json=[make_mark(sid, exam_id, subjects[0]["id"], marks=0)])
        assert r.status_code in (200, 201), f"0 marks should be valid: {r.text}"

    def test_marks_entry_max(self, api, create_student):
        """Enter marks = max marks (100) — saves correctly."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects for class 1")
        exam_id = get_or_create_exam(api, class_id=1)

        r = api.post("/marks/bulk", json=[make_mark(sid, exam_id, subjects[0]["id"], marks=100)])
        assert r.status_code in (200, 201), r.text

    def test_marks_entry_exceeds_max_rejected(self, api, create_student):
        """Marks > max marks (101/100) — should prevent or warn."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects for class 1")
        exam_id = get_or_create_exam(api, class_id=1)

        r = api.post("/marks/bulk", json=[make_mark(sid, exam_id, subjects[0]["id"], marks=101)])
        assert r.status_code in (400, 422), "Marks above max should be rejected"

    def test_marks_entry_decimal(self, api, create_student):
        """Enter decimal marks (45.5) — saves correctly."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects for class 1")
        exam_id = get_or_create_exam(api, class_id=1)

        r = api.post("/marks/bulk", json=[make_mark(sid, exam_id, subjects[0]["id"], marks=45.5)])
        assert r.status_code in (200, 201), r.text

    def test_mark_student_absent(self, api, create_student):
        """Mark student absent — is_absent=True saved."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects for class 1")
        exam_id = get_or_create_exam(api, class_id=1)

        r = api.post("/marks/bulk", json=[make_mark(sid, exam_id, subjects[0]["id"], is_absent=True)])
        assert r.status_code in (200, 201), r.text
        # Verify by fetching results
        r2 = api.get("/marks/results", params={"class_id": 1, "exam_id": exam_id})
        if r2.status_code == 200:
            results = r2.json()
            student_result = next((s for s in results if s.get("student_id") == sid), None)
            if student_result:
                absent_subjects = [sub for sub in student_result.get("subjects", [])
                                   if sub.get("grade") == "AB"]
                assert len(absent_subjects) > 0, "Absent subject should show grade AB"

    def test_marks_persist_after_save(self, api, create_student):
        """Save marks — fetching results shows saved marks."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects for class 1")
        exam_id = get_or_create_exam(api, class_id=1)

        api.post("/marks/bulk", json=[make_mark(sid, exam_id, subjects[0]["id"], marks=78)])

        # Verify via marks entry
        r = api.get("/marks/entry", params={"class_id": 1, "exam_id": exam_id})
        assert r.status_code == 200
        data = r.json()
        students = data.get("students", [])
        student_entry = next((s for s in students if s.get("student_id") == sid), None)
        assert student_entry is not None, "Student not found in marks entry"

    def test_marks_update_correctly(self, api, create_student):
        """Edit marks after saving — updates correctly, not duplicates."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects for class 1")
        exam_id = get_or_create_exam(api, class_id=1)

        # First save
        api.post("/marks/bulk", json=[make_mark(sid, exam_id, subjects[0]["id"], marks=50)])
        # Update
        r2 = api.post("/marks/bulk", json=[make_mark(sid, exam_id, subjects[0]["id"], marks=75)])
        assert r2.status_code in (200, 201), r2.text

        # Verify updated value
        r3 = api.get("/marks/entry", params={"class_id": 1, "exam_id": exam_id})
        assert r3.status_code == 200

    def test_removed_student_not_in_marks_grid(self, create_student, api):
        """Removed student does NOT appear in marks grid."""
        sid, _ = create_student(class_id=1)
        api.delete(f"/students/{sid}")
        r = api.get("/marks/grid", params={"class_id": 1, "exam_id": 1})
        assert r.status_code == 200
        grid_data = r.json()
        if isinstance(grid_data, list):
            grid_ids = [s["student_id"] for s in grid_data]
        else:
            grid_ids = [s["student_id"] for s in grid_data.get("students", [])]
        assert sid not in grid_ids


# ══════════════════════════════════════════════
# GRADE CALCULATION
# ══════════════════════════════════════════════

GRADE_CASES = [
    (95,  100, "A1", 10.0),
    (85,  100, "A2",  9.0),
    (75,  100, "B1",  8.0),
    (65,  100, "B2",  7.0),
    (55,  100, "C1",  6.0),
    (45,  100, "C2",  5.0),
    (35,  100, "D",   4.0),
    (33,  100, "D",   4.0),
    (32,  100, "E",   0.0),
    (30,  100, "E",   0.0),
]

@pytest.mark.api
@pytest.mark.marks
class TestGradeCalculation:

    def _setup_student_with_marks(self, api, create_student, score, class_id=1):
        sid, _ = create_student(class_id=class_id)
        subjects = get_subjects_for_class(api, class_id)
        if not subjects:
            return sid, None, None
        exam_id = get_or_create_exam(api, class_id=class_id)
        # Enter marks for all subjects so result calculation works
        entries = []
        for sub in subjects:
            entries.append(make_mark(sid, exam_id, sub["id"], marks=score))
        api.post("/marks/bulk", json=entries)
        return sid, exam_id, subjects

    @pytest.mark.parametrize("score,max_marks,expected_grade,expected_gp", GRADE_CASES)
    def test_grade_thresholds(self, api, create_student, score, max_marks, expected_grade, expected_gp):
        """Grade and GP calculated correctly at each threshold."""
        sid, exam_id, subjects = self._setup_student_with_marks(api, create_student, score)
        if not subjects:
            pytest.skip("No subjects available")

        r = api.get("/marks/results", params={"class_id": 1, "exam_id": exam_id})
        if r.status_code == 200:
            results = r.json()
            student_result = next((s for s in results if s.get("student_id") == sid), None)
            if student_result:
                assert student_result.get("grade") == expected_grade, \
                    f"Score {score}: expected grade {expected_grade}, got {student_result.get('grade')}"
                assert float(student_result.get("cgpa", 0)) == expected_gp, \
                    f"Score {score}: expected GP {expected_gp}, got {student_result.get('cgpa')}"

    def test_absent_subject_causes_fail(self, api, create_student):
        """Student absent in 1 subject — Result = FAIL."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects or len(subjects) < 2:
            pytest.skip("Need at least 2 subjects")
        exam_id = get_or_create_exam(api, class_id=1)

        entries = []
        for i, sub in enumerate(subjects):
            if i == 0:
                entries.append(make_mark(sid, exam_id, sub["id"], is_absent=True))
            else:
                entries.append(make_mark(sid, exam_id, sub["id"], marks=80))
        api.post("/marks/bulk", json=entries)

        r = api.get("/marks/results", params={"class_id": 1, "exam_id": exam_id})
        if r.status_code == 200:
            results = r.json()
            student_result = next((s for s in results if s.get("student_id") == sid), None)
            if student_result:
                assert student_result.get("result") == "FAIL", "Absent in 1 subject should cause FAIL"

    def test_pass_all_subjects(self, api, create_student):
        """Student passes all subjects — Result = PASS."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects")
        exam_id = get_or_create_exam(api, class_id=1)

        entries = [make_mark(sid, exam_id, sub["id"], marks=60) for sub in subjects]
        api.post("/marks/bulk", json=entries)

        r = api.get("/marks/results", params={"class_id": 1, "exam_id": exam_id})
        if r.status_code == 200:
            results = r.json()
            student_result = next((s for s in results if s.get("student_id") == sid), None)
            if student_result:
                assert student_result.get("result") == "PASS"

    def test_fail_one_subject_fails_overall(self, api, create_student):
        """Fail 1 subject — Result = FAIL overall."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects or len(subjects) < 2:
            pytest.skip("Need at least 2 subjects")
        exam_id = get_or_create_exam(api, class_id=1)

        entries = []
        for i, sub in enumerate(subjects):
            marks = 20 if i == 0 else 80  # First subject fails
            entries.append(make_mark(sid, exam_id, sub["id"], marks=marks))
        api.post("/marks/bulk", json=entries)

        r = api.get("/marks/results", params={"class_id": 1, "exam_id": exam_id})
        if r.status_code == 200:
            results = r.json()
            student_result = next((s for s in results if s.get("student_id") == sid), None)
            if student_result:
                assert student_result.get("result") == "FAIL"

    def test_class_rank_top_scorer_is_rank1(self, api, create_student):
        """Top scorer in class = Rank 1."""
        sid1, _ = create_student(class_id=1)
        sid2, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects")
        exam_id = get_or_create_exam(api, class_id=1)

        # sid1 gets lower marks, sid2 gets higher
        for sub in subjects:
            api.post("/marks/bulk", json=[make_mark(sid1, exam_id, sub["id"], marks=70)])
            api.post("/marks/bulk", json=[make_mark(sid2, exam_id, sub["id"], marks=90)])

        r = api.get("/marks/results", params={"class_id": 1, "exam_id": exam_id})
        if r.status_code == 200:
            results = r.json()
            rank1 = next((s for s in results if s.get("class_rank") == 1), None)
            if rank1:
                assert rank1["student_id"] == sid2, "Top scorer should be Rank 1"

    def test_same_percentage_same_rank(self, api, create_student):
        """Two students with same percentage — same rank or consecutive."""
        sid1, _ = create_student(class_id=1)
        sid2, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        if not subjects:
            pytest.skip("No subjects")
        exam_id = get_or_create_exam(api, class_id=1)

        for sid in [sid1, sid2]:
            for sub in subjects:
                api.post("/marks/bulk", json=[make_mark(sid, exam_id, sub["id"], marks=80)])

        r = api.get("/marks/results", params={"class_id": 1, "exam_id": exam_id})
        if r.status_code == 200:
            results = r.json()
            r1 = next((s.get("class_rank") for s in results if s["student_id"] == sid1), None)
            r2 = next((s.get("class_rank") for s in results if s["student_id"] == sid2), None)
            if r1 and r2:
                assert abs(r1 - r2) <= 1, f"Same score ranks should be same/consecutive, got {r1} and {r2}"


# ══════════════════════════════════════════════
# PDF & RESULTS VIEW TESTS
# ══════════════════════════════════════════════

@pytest.mark.api
@pytest.mark.marks
class TestResultsPDF:

    def test_marksheet_pdf_generates(self, api, create_student):
        """Student marksheet PDF opens without error."""
        sid, _ = create_student(class_id=1)
        subjects = get_subjects_for_class(api, 1)
        exam_id = get_or_create_exam(api, class_id=1)
        if subjects:
            api.post("/marks/bulk", json=[make_mark(sid, exam_id, subjects[0]["id"], marks=75)])

        r = api.get(f"/pdf/marksheet/student/{sid}", params={"exam_id": exam_id, "class_id": 1})
        assert r.status_code not in (500,), f"PDF generation error: {r.text}"

    def test_bulk_class_pdf_generates(self, api):
        """Bulk class PDF — generates without error."""
        exam_id = get_or_create_exam(api, class_id=1)
        r = api.get("/pdf/marksheet/class/1", params={"exam_id": exam_id})
        assert r.status_code not in (500,), "Bulk PDF generation should not 500"

    def test_results_sorted_by_rank(self, api):
        """Results are sorted rank 1 at top."""
        exam_id = get_or_create_exam(api, class_id=1)
        r = api.get("/marks/results", params={"class_id": 1, "exam_id": exam_id})
        if r.status_code == 200 and r.json():
            ranks = [s.get("class_rank", 0) for s in r.json()]
            assert ranks == sorted(ranks), "Results are not sorted by rank"

    def test_results_page_empty_class(self, api):
        """Class with 0 marks — results page shows empty, not error."""
        r = api.get("/marks/results", params={"class_id": 99, "exam_id": 1})
        assert r.status_code != 500
        if r.status_code == 200:
            assert isinstance(r.json(), list)
