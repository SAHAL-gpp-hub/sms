# Security Hardening Checklist

## Mandatory before production

- [ ] Enforce HTTPS with valid TLS certificate and HTTP→HTTPS redirect.
- [ ] Rotate `SECRET_KEY`, database password, SMTP credentials, payment keys, and messaging tokens.
- [ ] Keep `REGISTRATION_ENABLED=false` after first admin bootstrap.
- [ ] Restrict `/api/v1/auth/register` usage to first-run bootstrap only.
- [ ] Review CORS origins to production domains only.
- [ ] Confirm role guards for all admin/teacher-only routes.
- [ ] Enable centralized logging and alerting for authentication failures and 5xx errors.
- [ ] Ensure regular DB backup + restore drill is documented and tested.

## Recommended cadence

- Weekly: verify backup artifacts and auth failure spikes.
- Monthly: rotate high-risk secrets.
- Per release: run CI, smoke tests, and rollback rehearsal.
