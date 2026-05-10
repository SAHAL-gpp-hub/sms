# Iqra School Management System (SMS)

School Management System for Iqra English Medium School — Palanpur, Gujarat.
Built with FastAPI (backend) + React/Vite (frontend) + PostgreSQL.

---

## 🚀 Quick Start

### Prerequisites
- Docker ≥ 20.10 and Docker Compose ≥ 2.0
- `python3` (for generating secrets locally)

### 1 — Create your environment file

```bash
cp .env.example .env
```

Edit `.env` and fill in **all three** values:

| Variable            | Description                                  |
|---------------------|----------------------------------------------|
| `POSTGRES_PASSWORD` | Strong password for the PostgreSQL database  |
| `DATABASE_URL`      | Connection string (pre-filled in `.env.example`) |
| `SECRET_KEY`        | 64-char random hex string for JWT signing    |
| `REGISTRATION_ENABLED` | Set `true` only during first-run setup    |

**Generate a secret key:**

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output into `.env` as `SECRET_KEY=<output>`.

> ⚠️ **Never commit `.env` to git.** It is listed in `.gitignore`.

---

### 2 — First-run setup

```bash
# Start the stack
docker-compose up -d

# Wait ~15 seconds for the DB to initialise, then create the admin user.
# Temporarily enable registration:
#   In .env, set REGISTRATION_ENABLED=true
#   docker-compose up -d --force-recreate backend

# Create the admin account
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@school.in","password":"your-password","role":"admin"}'

# Disable registration again!
#   In .env, set REGISTRATION_ENABLED=false (or remove the line)
#   docker-compose up -d --force-recreate backend

# Seed initial data (classes, fee heads, etc.)
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=admin@school.in&password=your-password" | jq -r .access_token)
curl -X POST http://localhost:8000/api/v1/setup/seed \
  -H "Authorization: Bearer $TOKEN"
```

Open the app at **http://localhost** and log in.

---

### Development (hot-reload)

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

The `docker-compose.dev.yml` override mounts `./backend:/app` for hot-reload
and exposes the PostgreSQL port `5432` for local DB tools.

---

## 🔐 Security Notes

- **Change `SECRET_KEY`** before any public deployment — the example value is not secret.
- **Disable `REGISTRATION_ENABLED`** (set to `false` or omit) after creating the first admin.
  Leaving it enabled allows anyone on the network to create admin accounts.
- **Enable HTTPS** before going to production — see `nginx.conf` for a commented-out
  TLS configuration block. Use Let's Encrypt / certbot for free certificates.
- The **PostgreSQL port is not exposed** to the host in production (`docker-compose.yml`).
  Use `docker-compose.dev.yml` if you need direct DB access for local development.

---

## 🏗️ Architecture

```
nginx (port 80) ──▶ frontend (React/Vite, port 80)
                ──▶ backend  (FastAPI,     port 8000) ──▶ db (PostgreSQL)
```

| Service    | Technology              | Container        |
|------------|-------------------------|------------------|
| Frontend   | React 18 + Vite + Tailwind CSS | `sms_frontend` |
| Backend    | FastAPI + SQLAlchemy + Alembic | `sms_backend`  |
| Database   | PostgreSQL 15           | `sms_db`         |
| Proxy      | nginx                   | `sms_frontend`   |

---

## 📋 Features

- Student management (CRUD, search, pagination)
- Fee management (structures, assignment, payments, defaulters)
- Marks & grading (GSEB grade scale, bulk entry, results)
- Attendance (daily marking, monthly summary)
- PDF reports (marksheets, Transfer Certificates, result reports)
- Year-end (academic year creation, class promotion, TC issuance)
- JWT authentication with rate-limited login and token revocation (logout)

---

## 🧪 Running Tests

See [`sms_tests/README.md`](sms_tests/README.md) for the full test suite.

```bash
cd sms_tests
cp .env.example .env
pip install -r requirements.txt
pytest tests/ -v
```

---

## 🔁 CI/CD

- CI workflows are under `.github/workflows/ci.yml`:
  - backend: `pytest`
  - frontend: `npm run lint` + `npm run build`
  - extended API suite: `sms_tests/run_tests.sh --api-only`
- Manual deployment workflow with rollback checklist is in `.github/workflows/deploy.yml`.

---

## 📚 Runbooks

- Onboarding: [`docs/runbooks/onboarding.md`](docs/runbooks/onboarding.md)
- Release + rollback: [`docs/runbooks/release-rollback.md`](docs/runbooks/release-rollback.md)
- Backup + restore: [`docs/runbooks/backup-restore.md`](docs/runbooks/backup-restore.md)
- Security hardening checklist: [`docs/security-hardening-checklist.md`](docs/security-hardening-checklist.md)
- RBAC review baseline: [`docs/rbac-endpoint-review.md`](docs/rbac-endpoint-review.md)
