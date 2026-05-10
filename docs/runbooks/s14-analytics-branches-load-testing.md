# S14 Runbook — Analytics + Multi-Branch Foundation + Load Testing

## 1) Analytics dashboard

- URL: `/analytics` (admin only)
- Backend endpoints:
  - `GET /api/v1/analytics/fee-collection`
  - `GET /api/v1/analytics/class-performance`
  - `GET /api/v1/analytics/grade-distribution`
  - `GET /api/v1/analytics/attendance-trends`
  - `GET /api/v1/analytics/top-students`
  - `GET /api/v1/analytics/at-risk-attendance`

Use this dashboard for school-wide monthly fee trends, grade distribution, class averages, attendance trends, top students, and at-risk attendance tracking.

## 2) Multi-branch foundation

### Schema foundation

- New table: `branches`
- Added nullable `branch_id` FKs to:
  - `academic_years`
  - `classes`
  - `students`
  - `users`

### Default branch behavior

- Config key: `DEFAULT_BRANCH_ID` (default `1`)
- Existing records remain valid with nullable branch mapping.
- New student/user/class setup paths default to `DEFAULT_BRANCH_ID` if not provided.

### Branch admin endpoints

- `GET /api/v1/admin/branches` — list branches
- `POST /api/v1/admin/branches` — create branch

## 3) Load testing

### Files

```
load_tests/
├── locustfile.py
├── scenarios/
│   ├── fee_payment.py
│   ├── marks_entry.py
│   ├── portal_login.py
│   └── student_list.py
└── reports/
    └── .gitkeep
```

### Install

- Add dev dependency: `locust==2.28.0` (in `backend/requirements-dev.txt`)

### Run

```bash
cd load_tests
locust -f locustfile.py --host=https://iqraschool.in \
  --users=100 --spawn-rate=10 --run-time=5m --headless \
  --html reports/report_$(date +%Y%m%d).html
```

### Suggested p95 targets

- Portal dashboard (100 parents): `< 800ms`
- Teacher student list (50 teachers): `< 500ms`
- Bulk marks entry (20 teachers concurrent): `< 1000ms`
- Admin defaulter PDF (10 admins): `< 3000ms`
- Login endpoint (200 simultaneous): `< 500ms`
