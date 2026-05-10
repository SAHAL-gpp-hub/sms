# Runbook: Release and Rollback

## Release flow

1. Merge to protected branch after CI green.
2. Trigger deploy workflow with target environment and image tag.
3. Run smoke checks:
   - login
   - student list
   - fee payment entry
   - marks report generation
4. Record release tag, timestamp, and verifier in release log.

## Rollback trigger

Rollback immediately if:

- sustained 5xx on critical APIs
- auth failures spike after release
- payment/marks write paths break

## Rollback steps

1. Redeploy previous known-good image tag.
2. Verify `/health` and smoke checks.
3. Confirm queue/notifications resume.
4. Capture incident notes and root-cause follow-up task.

## Post-rollback

- Keep failed artifact for investigation.
- Add regression tests for the failure path.
