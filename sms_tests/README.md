# 🏫 SMS Automated Test Suite

Complete automated test suite for your School Management System covering **all 130+ checklist items** across Students, Fees, Marks, Attendance, Reports, TC, Year-End, and System tests.

---

## 📁 Structure

```
sms_tests/
├── conftest.py              # Shared fixtures (API client, browser, data factories)
├── pytest.ini               # Pytest config, markers, report settings
├── requirements.txt         # Python dependencies
├── .env.example             # Config template (copy to .env)
├── run_tests.sh             # 🚀 Master runner script
├── checklist_runner.py      # Visual HTML checklist generator
├── tests/
│   ├── test_students.py     # Student CRUD, validation, search, filter
│   ├── test_fees.py         # Fee structure, payments, receipts, defaulters
│   ├── test_marks.py        # Marks grid, grade thresholds, results, PDF
│   ├── test_attendance.py   # Daily marking, monthly summary, boundaries
│   └── test_reports_tc_system.py  # Reports, TC, Year-End, System/cross-feature
└── reports/                 # Auto-generated (gitignore this)
    ├── report.html          # Rich pytest HTML report
    ├── report.json          # Machine-readable results
    ├── checklist.html       # ✅ Visual checklist with pass/fail per item
    └── pytest_output.txt    # Console log
```

---

## ⚡ Quick Start

### 1. Copy and configure
```bash
cp .env.example .env
# Edit .env — set BASE_URL, FRONTEND_URL to match your Docker setup
```

### 2. Make sure SMS is running
```bash
docker-compose up -d
# Wait for services to be healthy
```

### 3. Run everything
```bash
chmod +x run_tests.sh
./run_tests.sh
```

### 4. View results
Open `reports/checklist.html` in your browser — you'll see a color-coded checklist of every test item.

---

## 🎯 Running Specific Tests

```bash
# Only fast API tests (no browser needed)
./run_tests.sh --api-only

# Only UI browser tests
./run_tests.sh --ui-only

# Only one module
./run_tests.sh --module students
./run_tests.sh --module fees
./run_tests.sh --module marks
./run_tests.sh --module attendance
./run_tests.sh --module reports
./run_tests.sh --module tc
./run_tests.sh --module yearend
./run_tests.sh --module system

# By keyword
./run_tests.sh -k "grade"
./run_tests.sh -k "defaulter"
./run_tests.sh -k "absent"

# Directly with pytest (after activating venv)
source venv/bin/activate
pytest tests/test_marks.py -v
pytest tests/test_fees.py::TestDefaulters -v
pytest -m "api and students" -v
```

---

## 🔧 Configuration

Edit `.env` to match your setup:

| Variable        | Default                       | Description                    |
|----------------|-------------------------------|--------------------------------|
| `BASE_URL`     | `http://localhost:8000`       | FastAPI backend URL            |
| `FRONTEND_URL` | `http://localhost`            | React frontend URL             |
| `API_URL`      | `http://localhost:8000/api`   | API prefix (change if needed)  |
| `HEADLESS`     | `true`                        | Set `false` to watch browser   |
| `BROWSER`      | `chromium`                    | `chromium` / `firefox`         |

---

## 🔌 Adapting to Your API

The test suite assumes standard REST conventions. You may need to adjust:

### 1. Endpoint paths
Check `conftest.py` and test files for paths like `/students/`, `/fees/structure/`, etc.
Match them to your actual FastAPI routes (check `http://localhost:8000/docs`).

### 2. Request/response field names
If your API uses `student_name` instead of `first_name`, update `StudentFactory` in `conftest.py`.

### 3. UI selectors
UI tests use flexible selectors but may need tuning. Look for `pytest.skip()` calls in UI tests — they'll tell you which selectors need adjustment for your specific React component structure.

---

## 📊 Test Markers Reference

| Marker       | What it covers                          |
|-------------|------------------------------------------|
| `api`       | Pure API tests (httpx, fast)            |
| `ui`        | Browser tests (Playwright)              |
| `students`  | Student management                      |
| `fees`      | Fee structure + payments                |
| `marks`     | Marks entry + grades                    |
| `attendance`| Attendance marking + summary            |
| `reports`   | PDF report generation                   |
| `tc`        | Transfer certificates                   |
| `yearend`   | Academic year + promotion               |
| `system`    | Cross-feature + integration             |
| `critical`  | Must-pass core tests                    |

---

## 📝 Checklist Coverage

| Section              | Auto Tests | Manual Only |
|---------------------|------------|-------------|
| Student Management  | ✅ ~20     | 2 (Aadhar behavior) |
| Fee Structure       | ✅ ~16     | 1 (overpayment docs) |
| Marks & Grades      | ✅ ~24     | 0 |
| Attendance          | ✅ ~16     | 0 |
| Reports (PDFs)      | ✅ ~7      | 3 (visual quality) |
| Transfer Certificate| ✅ ~7      | 2 (signature/stamp area) |
| Year-End            | ✅ ~8      | 2 (student form dropdown) |
| System              | ✅ ~9      | 3 (Docker restart, two tabs) |

**Tests that must remain manual** (visual/infrastructure):
- PDF print quality on A4 paper
- Gujarati text rendering visually correct
- Docker restart data persistence
- Two browser tabs sync behavior
- School name spelling in PDFs

---

## 🐛 Troubleshooting

**`Connection refused` errors**
→ SMS backend isn't running. Run `docker-compose up -d` and wait 30 seconds.

**`404` on all API endpoints**
→ Your API prefix might differ. Check `/docs` and update `API_URL` in `.env`.

**UI tests all failing**
→ Set `HEADLESS=false` in `.env` to watch the browser and see what's happening.

**`playwright install` needed**
→ Run `source venv/bin/activate && playwright install chromium`

**Grade tests failing**
→ Your grade boundaries in the API may differ slightly. Check `GRADE_CASES` in `test_marks.py` and adjust thresholds to match your `gradecalculator.py`.
