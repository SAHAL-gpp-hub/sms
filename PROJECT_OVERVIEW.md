# Project Overview — Iqra School Management System (SMS)

This document summarizes the repository: features, architecture, major user flows, dev & deploy instructions, testing, observability, and where to find important code. Use this as a living reference when onboarding or auditing the project.

---

**Highlights**
- Backend: FastAPI + SQLAlchemy + Alembic (Python)
- Frontend: React (Vite) + Tailwind
- Database: PostgreSQL
- Deployment: Docker Compose (dev/prod overrides) + nginx
- Auth: JWT access tokens + httpOnly refresh cookie + optional admin 2FA

---

**Primary Features**
- Student management: create/read/update/delete students, search, pagination.
- Enrollment management: enrollments, roll lists, roll reassignment.
- Fees: fee heads, fee structures, assignment, ledger, payments, defaulters.
- Marks & grading: subjects, exams, bulk marks entry, results, marksheet PDFs.
- Attendance: daily marking and monthly summaries.
- Portal: student/parent-facing endpoints for profile, marks, attendance, fees.
- Reports & PDFs: marksheets, transfer certificates (signed/temporarily tokenized PDFs).
- Year-end operations: create/activate academic years, promote classes, clone fees/subjects, lock marks.
- Imports: CSV import pipeline (preview/commit/rollback) for bulk student imports.
- Notifications: queued worker for OTPs, reminders and retry mechanisms.
- RBAC: role-based access (admin, teacher, student, parent) with helper guards.

(Feature list derived from [README.md](README.md) and code.)

---

**High-level Architecture**

- nginx (static + reverse proxy) serves frontend and reverse-proxies the API.
- Frontend: React app built with Vite; communicates with backend under `/api/v1`.
- Backend: FastAPI app (entrypoint: [backend/app/main.py](backend/app/main.py)).
  - Routers are modular (see [backend/app/routers](backend/app/routers)).
  - SQLAlchemy models are registered under [backend/app/models](backend/app/models).
  - Alembic handles schema migrations in [backend/migrations](backend/migrations).
- Database: PostgreSQL container configured via Docker Compose.
- Background worker(s): notification worker and periodic cleanup tasks started in FastAPI lifespan.
- Real-time: WebSocket endpoint for job status updates (`/ws/jobs/{job_id}` in [main.py](backend/app/main.py)).

Diagram (logical):

```mermaid
flowchart LR
  Browser -->|HTTP| NGINX
  NGINX --> Frontend[React (Vite)]
  Frontend -->|/api/v1| Backend[FastAPI]
  Backend -->|SQL| Postgres[(PostgreSQL)]
  Backend -->|background| NotificationsWorker[Notification Worker]
  Backend -->|migrations| Alembic
```

---

**Key Code Areas & Entry Points**
- Project README and setup: [README.md](README.md)
- Backend entrypoint: [backend/app/main.py](backend/app/main.py)
- API routers: [backend/app/routers](backend/app/routers) (examples: `auth.py`, `students.py`, `fees.py`, `marks.py`, `yearend.py`, `enrollments.py`)
- Auth & security: [backend/app/routers/auth.py](backend/app/routers/auth.py) — JWT issuance, refresh sessions, admin 2FA, token blocklist.
- Models & migrations: [backend/app/models](backend/app/models) and [backend/migrations](backend/migrations)
- Services (business logic): [backend/app/services](backend/app/services) — e.g., `student_service.py`, `fee_service.py`, `notification_service.py`.
- Frontend API layer: [frontend/src/services/api.js](frontend/src/services/api.js) — maps UI flows to backend endpoints and handles refresh flow.
- Frontend app entry: [frontend/src/main.jsx](/frontend/src/main.jsx) and top-level layout [frontend/src/App.jsx](/frontend/src/App.jsx).
- Docker orchestration: `docker-compose.yml` plus `docker-compose.dev.yml` and `docker-compose.prod.yml`.

---

**Authentication & Authorization Flow (concise)**
- Login: POST `/api/v1/auth/login` accepts OAuth2 `username` + `password` and returns an access JWT and sets an httpOnly refresh cookie. (See [auth.py](backend/app/routers/auth.py))
- Admin 2FA: Admin users with `two_factor_enabled` get a temporary OTP challenge via SMS/WhatsApp; verify via `/auth/verify-2fa`.
- Refresh: `POST /api/v1/auth/refresh` rotates refresh sessions and issues new access tokens; refresh tokens stored server-side hashed in `AuthRefreshSession` with family linking.
- Logout: `POST /api/v1/auth/logout` adds token `jti` to `TokenBlocklist` so access tokens can be revoked.
- Access control: `get_current_user` dependency extracts user from JWT; `require_role()` and helper guards (`ensure_student_access`, `ensure_class_access`) enforce RBAC.
- Frontend handles 401 by attempting refresh once and then showing a session expiry modal; see [frontend/src/services/api.js](frontend/src/services/api.js).

---

**Major User Flows**
- First-run admin bootstrap
  1. Copy `.env.example` → `.env`, set `REGISTRATION_ENABLED=true` and `SECRET_KEY`, `DATABASE_URL`.
  2. Start stack via `docker-compose up -d` and create admin via `/api/v1/auth/register`.
  3. Disable `REGISTRATION_ENABLED` and seed setup via `/setup/seed`.
  (See [README.md](README.md) for steps.)

- Teacher/Admin day-to-day
  - Login → operate in admin UI: manage students, create fees, mark attendance, enter marks, generate PDFs.
  - Year-end promotion: create a new academic year, validate promotion, promote classes (job created), track via WebSocket.

- Student / Parent portal
  - Accounts generated/invited by admin; portals can fetch `me`-scoped data: profile, results, attendance, fees.

- Bulk imports & rollbacks
  - Admin uploads CSV via import endpoints; preview then commit; batches recorded and can be rolled back.

- Payments
  - Frontend calls `/payments/create-order` and `/payments/verify`; payments history accessible per-student.

---

**Database & Migrations**
- Schema managed by Alembic in [backend/migrations](backend/migrations). Startup runs migrations automatically (unless DB dependency is overridden).
- Models registered in `app.models.base_models` and distributed per feature area.
- Notable migration files exist for RBAC, online payments, indexes and unique constraints.

---

**Observability & Operation**
- Logging: Structured JSON logging (see `JsonFormatter` in [main.py](backend/app/main.py)).
- Health endpoints: `/health`, `/health/live`, `/health/ready`.
- Latency metrics: `/metrics/latency` (admin-only) calculates percentile windows maintained in-process.
- Runbooks & operational docs: see [docs/](docs) — onboarding, cloud deployment, backup/restore, security checklist.

---

**Testing & CI**
- Backend tests: `backend/tests` (pytest). CI enforces `--cov` threshold.
- End-to-end: `frontend/tests/e2e` (Playwright) and `sms_tests/` (extended API/acceptance tests).
- Local API-only test runner available: `sms_tests/run_tests.sh --api-only` (see [sms_tests/README.md](sms_tests/README.md)).

---

**Deployment & Development**
- Development: `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up` mounts backend for hot reload and exposes DB port for tools.
- Production: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` (nginx + TLS config expectations).
- Environment: `.env` controls `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `REGISTRATION_ENABLED`, and worker toggles.

---

**Security Notes & Best Practices**
- Ensure `SECRET_KEY` is strong and not committed.
- Disable registration after initial admin account creation.
- Configure `CORS_ORIGINS` for your deployed frontend domains.
- Consider a shared cache / central job queue when scaling to multiple backend replicas (current cache and latency windows are process-local).
- For multi-worker deployments, move background workers and scheduled cleanups to separate processes (currently run in FastAPI lifespan task).

---

**Where to Look Next (audit checklist)**
- Review RBAC enforcement in [backend/app/routers/auth.py](backend/app/routers/auth.py) and `require_role` usage across routers.
- Inspect `notification_service` and queue semantics in [backend/app/services/notification_service.py].
- Check versioned migrations under [backend/migrations/versions](backend/migrations/versions) for data-transforming migrations.
- Examine frontend auth recovery flow in [frontend/src/services/api.js] to validate cookie/security flags and refresh behavior.

---

If you'd like, I can:
- Generate an ER diagram from the SQLAlchemy models.
- Produce a detailed API endpoint catalog (paths, methods, request/response schemas) extracted from routers.
- Run the test suite and summarize failures/flakiness.

Tell me which of the above you'd like next, and I will proceed.
