# Runbook: Environment Onboarding

## 1) Initial setup

```bash
cd /home/runner/work/sms/sms
cp .env.example .env
```

Fill required secrets in `.env`:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SECRET_KEY`

Generate key:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## 2) Start stack

```bash
docker compose up -d --build
```

## 3) Bootstrap admin (one-time only)

1. Temporarily set `REGISTRATION_ENABLED=true`.
2. Recreate backend container.
3. Call `/api/v1/auth/register` once.
4. Set `REGISTRATION_ENABLED=false` immediately.

## 4) Seed system data

Use existing setup endpoint after admin login:

```bash
curl -X POST http://localhost:8000/api/v1/setup/seed -H "Authorization: Bearer <token>"
```

## 5) Validate

- Backend health: `http://localhost:8000/health`
- Frontend: `http://localhost`
- Login with admin account.
