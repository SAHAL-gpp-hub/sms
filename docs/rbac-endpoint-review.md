# RBAC Endpoint Review (Initial Baseline)

## Public access (no JWT)

- `/api/v1/auth/*` (login, register, register-status, logout, me rules as defined in router)
- `/api/v1/student-auth/*`
- `/api/v1/pdf/*`
- Public payment router endpoints
- Select year-end public endpoints inside `yearend` router

## JWT-protected routers

All routes below are globally protected by `Depends(get_current_user)` in `backend/app/main.py`:

- students
- setup
- fees
- imports
- marks
- attendance
- admin_users
- portal
- payments (protected router)
- notifications
- enrollments
- report_cards

## Next RBAC hardening actions

1. Enumerate each endpoint and explicit `require_role(...)` use per router.
2. Verify teacher scoping logic for class/subject restrictions.
3. Add endpoint-level authorization tests for admin write actions.
4. Add negative tests for student/parent attempts on staff endpoints.
5. Track results in this file each release.
