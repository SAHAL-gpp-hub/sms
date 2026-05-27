# API Observability, Coverage, and Readiness

This note tracks the current implementation state for coverage reporting, API docs, error handling, and database performance.

## Coverage and CI

- Backend CI now runs `pytest` with coverage enabled and fails the job if coverage drops below 80%.
- Coverage reports are emitted in terminal output and as `backend/reports/backend-coverage.xml` in CI artifacts.
- The current `.coveragerc` excludes migrations and test code from the reported denominator.

## API docs and endpoint maturity

FastAPI already exposes `/openapi.json`, `/docs`, and `/redoc`. The generated docs are most useful when routers are tagged consistently and endpoint descriptions stay explicit.

Suggested endpoint maturity badges:

| Area | Badge | Notes |
| --- | --- | --- |
| `/api/v1/auth/*` | Stable | Authentication and token lifecycle are core platform behavior. |
| `/api/v1/students/*` | Stable | Core CRUD and list/search flows. |
| `/api/v1/fees/*` | Stable | Production workflow with caching and write invalidation. |
| `/api/v1/attendance/*` | Stable | Operational school-day workflow. |
| `/api/v1/analytics/*` | Stable | Read-only dashboard endpoints. |
| `/api/v1/yearend/*` | Beta | High-risk operational paths that should stay gated and well-tested. |
| `/api/v1/payments/webhook` | Beta | Public webhook boundary with signature validation. |
| `/api/v1/pdf/*` | Stable | Download/report generation surface. |

Auth and rate-limit notes to keep in endpoint descriptions:

- Login is rate-limited by SlowAPI at 10 requests per minute per IP.
- Registration should be treated as bootstrap-only and disabled after first admin creation.
- Admin-only endpoints should explicitly mention the required role in the description where the router-level dependency is not obvious.
- Webhook endpoints must call out signature validation and expected provider headers.

## Error handling reference

Use the same response shape across routers when possible:

| Status | Meaning | Typical cause |
| --- | --- | --- |
| 400 | Bad request | Invalid business rule or malformed domain input. |
| 401 | Unauthorized | Missing or invalid bearer token. |
| 403 | Forbidden | Role mismatch or student/parent scope violation. |
| 404 | Not found | Missing student, fee, year, or related record. |
| 422 | Unprocessable entity | Validation failure or domain rule violation. |
| 429 | Too many requests | Login or other rate-limited path. |
| 500 | Server error | Unexpected failure or unhandled exception. |

## Observability

- Every HTTP response now carries `X-Request-ID` and `X-Trace-ID`.
- Response timing is exposed via `X-Request-Time-Ms`.
- Request failures and slow requests are logged in JSON format with the same request ID.
- Health endpoints:
  - `GET /health` for combined status and DB connectivity
  - `GET /health/live` for process liveness
  - `GET /health/ready` for readiness checks that include DB connectivity

## Database performance

Strategic indexes added in the latest migration:

- `attendance(class_id, date)`
- `fee_payments(student_fee_id)`
- `marks(exam_id, subject_id)`
- `student_fees(enrollment_id, academic_year_id)`
- `enrollments(class_id, academic_year_id, status)`

These support common list, dashboard, and year-end queries that otherwise require repeated joins or table scans.

N+1 prevention patterns used or recommended:

- Prefer query shaping in service functions over per-row lookups in routers.
- Use `joinedload`/`selectinload` when a list endpoint always needs related records.
- Cache small read-heavy dashboard results and invalidate on writes, as already done for attendance and fees dashboards.
- Keep year-end promotion validation batched; avoid querying each student individually inside a loop unless the loop is already bounded and cached.

## Untested edge cases to close next

- RBAC
  - Teacher access should be verified for class-scoped and subject-scoped writes separately.
  - Parent access should be denied for sibling records outside the linked student set.
  - Inactive users should remain blocked even if their role is otherwise valid.
- Fee calculations
  - Partial payments that cross invoice boundaries.
  - Arrear invoice creation when a source invoice is partially paid.
  - Zero-assignment paths when class/year filters do not match any enrolled students.
- Year-end
  - Promotion undo after partial side effects.
  - Validation failures when a draft year lacks subjects or fee structures.
  - Locking marks when some records are already locked.
