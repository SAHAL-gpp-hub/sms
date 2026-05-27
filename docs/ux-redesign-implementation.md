# Iqra SMS UX Redesign Implementation

This note records the completed UX redesign work from `iqra-sms-ux-redesign-plan.md` so future changes preserve the same product intent.

## Experience Principles

- Role-first navigation: admins see operational work and setup areas; teachers see only classroom workflows.
- Progressive disclosure: risky or rare actions now live behind confirmation modals or advanced sections.
- Recoverable input: long-running student entry keeps draft recovery visible and non-blocking.
- Mobile-first operations: attendance, parent portal, and payment flows keep primary actions reachable on small screens.
- Explicit state over hidden defaults: missing attendance is unmarked, failed notifications can be retried, and payment success remains visible until dismissed.

## Implemented Areas

- Authentication now persists sessions across reloads with expiry checks, proactive refresh, and a non-dismissible expired-session return path.
- Dashboard now prioritizes today's operational queue, monthly collections, defaulters, OTP failures, and pending corrections.
- Student onboarding includes guided empty states, two-step entry, draft recovery, and clearer withdrawal and transfer-certificate language.
- Attendance now treats missing records as `UNMARKED`, highlights incomplete rows, keeps bulk actions in a sticky footer, and improves tap targets.
- Fee setup previews apply-and-assign work, hides repair tools under advanced options, and keeps online payment success and failure states explicit.
- Parent portal cards deep-link into marks, attendance, and fees, with a fee callout and color-blind-safe attendance markings.
- Year-end workflows default to the active source year, constrain force options, export promotion reports, and clarify irreversible mark locking.
- Bulk year-end promotion now shows per-class live progress while the job runs.
- Notifications now expose retry for failed outbox rows and reset retry metadata server-side.
- Portal activation accepts student ID, GR number, or registered phone number.
- Admin navigation includes Marks again, with dashboard workflow tabs for Today, Students, Fees, Marks, Reports, and Year-End.
- Teacher dashboards show today's attendance completion and latest marks-entry progress for assigned classes.
- Marks entry uses mobile student cards on small screens instead of forcing horizontal grid entry.
- Analytics uses a summary endpoint and lazy chart rendering.
- Attendance analytics can use a bulk monthly summary query for an academic year.
- ESLint enforces accessible names for literal SVG-only icon buttons.

## Verification

Run these commands before shipping related changes:

```bash
cd frontend
npm run build
npm run lint
npm run test:e2e -- ux-recovery.spec.js
```

```bash
.codex-venv/bin/python -m pytest backend/tests/test_student_activation.py backend/tests/test_notifications.py
python -m py_compile backend/app/services/student_activation_service.py backend/app/routers/notifications.py backend/app/services/attendance_service.py
```

The live `sms_tests/tests/test_attendance.py -m api` suite also exercises attendance against `http://localhost:8000`; it requires a running seeded backend and valid `TEST_EMAIL`/`TEST_PASSWORD`.
