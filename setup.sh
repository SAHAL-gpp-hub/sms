#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# setup.sh — One-shot setup + troubleshooting for Iqra School SMS
#
# Run this whenever the app "isn't talking to the database".
# It diagnoses the problem and offers to fix it.
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh              # Full setup (Docker)
#   ./setup.sh --local      # Local development (no Docker)
#   ./setup.sh --diagnose   # Only diagnose, don't change anything
#   ./setup.sh --reset-db   # ⚠️  Wipe and recreate the database
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
section() { echo -e "\n${BOLD}${BLUE}══ $* ══${NC}"; }

MODE="docker"
DIAGNOSE_ONLY=false
RESET_DB=false

for arg in "$@"; do
  case $arg in
    --local)    MODE="local" ;;
    --diagnose) DIAGNOSE_ONLY=true ;;
    --reset-db) RESET_DB=true ;;
  esac
done

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   Iqra School SMS — Setup & Diagnosis Tool       ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Prerequisites ──────────────────────────────────────────────────────
section "Checking Prerequisites"

if [[ "$MODE" == "docker" ]]; then
  if ! command -v docker &>/dev/null; then
    error "Docker is not installed. Install Docker Desktop from https://docker.com"
    exit 1
  fi
  ok "Docker found: $(docker --version)"

  if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
    error "docker-compose not found. Install Docker Desktop (includes compose)."
    exit 1
  fi
  ok "Docker Compose found."
else
  if ! command -v python3 &>/dev/null; then
    error "Python 3 not found. Install from https://python.org"
    exit 1
  fi
  ok "Python: $(python3 --version)"

  if ! command -v psql &>/dev/null; then
    warn "psql not found. Install PostgreSQL client tools."
  else
    ok "psql found: $(psql --version)"
  fi
fi

# ── 2. Environment file ───────────────────────────────────────────────────
section "Environment Configuration"

if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    warn ".env not found. Creating from .env.example..."
    cp .env.example .env
    warn "IMPORTANT: Edit .env and set a real SECRET_KEY before production use."
    warn "  Generate one: python3 -c \"import secrets; print(secrets.token_hex(32))\""
  else
    error ".env and .env.example both missing. Cannot configure the application."
    exit 1
  fi
else
  ok ".env file found."
fi

# Check for placeholder secret
if grep -q "REPLACE_WITH_OUTPUT" .env 2>/dev/null; then
  warn "SECRET_KEY in .env is still the placeholder. Generating a real one..."
  REAL_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo "")
  if [[ -n "$REAL_SECRET" ]]; then
    sed -i.bak "s|SECRET_KEY=REPLACE_WITH_OUTPUT.*|SECRET_KEY=$REAL_SECRET|" .env
    ok "SECRET_KEY updated in .env."
  fi
fi

# ── 3. Docker mode setup ──────────────────────────────────────────────────
if [[ "$MODE" == "docker" ]]; then
  section "Docker Setup"

  if $RESET_DB; then
    warn "⚠️  RESETTING DATABASE — all data will be lost in 5 seconds..."
    sleep 5
    docker-compose down -v 2>/dev/null || true
    info "Database volume removed."
  fi

  # Start services
  if ! $DIAGNOSE_ONLY; then
    info "Starting Docker services..."
    docker-compose up -d --build
    info "Waiting for PostgreSQL to be healthy..."
    for i in $(seq 1 30); do
      if docker-compose exec -T db pg_isready -U sms_user -d school_sms &>/dev/null; then
        ok "PostgreSQL is healthy."
        break
      fi
      if [[ $i -eq 30 ]]; then
        error "PostgreSQL did not become healthy in 30 seconds."
        error "Check logs: docker-compose logs db"
        exit 1
      fi
      echo -n "."
      sleep 1
    done
    echo ""
  fi

  # Check container status
  section "Container Status"
  docker-compose ps 2>/dev/null || docker ps --filter "name=sms_"

  # Check backend logs for DB errors
  section "Backend Startup Logs (last 30 lines)"
  docker-compose logs --tail=30 backend 2>/dev/null || true

fi

# ── 4. DB connectivity test ───────────────────────────────────────────────
section "Database Connectivity Test"

if [[ "$MODE" == "docker" ]]; then
  # Test from inside the backend container
  DB_TEST=$(docker-compose exec -T backend python3 -c "
from app.core.database import check_db_connection
result = check_db_connection()
print('CONNECTED' if result else 'FAILED')
" 2>/dev/null || echo "EXEC_FAILED")

  if [[ "$DB_TEST" == "CONNECTED" ]]; then
    ok "Backend can reach PostgreSQL. ✅"
  else
    error "Backend CANNOT reach PostgreSQL. ❌"
    error ""
    error "Common causes and fixes:"
    error "  1. DB container not healthy:"
    error "     docker-compose logs db | tail -20"
    error ""
    error "  2. Wrong DATABASE_URL (hostname):"
    error "     Inside Docker → use 'db' (the service name)"
    error "     Outside Docker → use 'localhost'"
    error "     Current value in docker-compose.yml:"
    grep "DATABASE_URL" docker-compose.yml | head -1 || true
    error ""
    error "  3. Wrong credentials:"
    error "     DB expects: sms_user / sms_pass / school_sms"
    error "     docker-compose exec db psql -U sms_user -d school_sms -c 'SELECT 1'"
    error ""
    error "  4. Backend started before DB was ready:"
    error "     The fixed docker-compose.yml uses 'depends_on: condition: service_healthy'"
    error "     Rebuild: docker-compose down && docker-compose up -d --build"
    exit 1
  fi

else
  # Local mode — test directly
  DB_URL="${DATABASE_URL:-postgresql://sms_user:sms_pass@localhost:5432/school_sms}"
  if python3 -c "
import psycopg2, os
try:
    conn = psycopg2.connect('$DB_URL', connect_timeout=5)
    conn.close()
    print('CONNECTED')
except Exception as e:
    print(f'FAILED: {e}')
" 2>/dev/null | grep -q "CONNECTED"; then
    ok "Connected to PostgreSQL at $DB_URL"
  else
    error "Cannot connect to PostgreSQL. Details:"
    python3 -c "
import psycopg2
try:
    psycopg2.connect('$DB_URL', connect_timeout=5)
except Exception as e:
    print(f'  Error: {e}')
" 2>/dev/null || true
    error ""
    error "To create the database locally:"
    error "  createuser -s sms_user"
    error "  createdb -O sms_user school_sms"
    error "  psql -c \"ALTER USER sms_user WITH PASSWORD 'sms_pass';\""
    exit 1
  fi
fi

# ── 5. Run migrations ──────────────────────────────────────────────────────
section "Database Migrations"

if ! $DIAGNOSE_ONLY; then
  if [[ "$MODE" == "docker" ]]; then
    info "Running Alembic migrations inside backend container..."
    docker-compose exec -T backend sh -c "
      cd /app
      DATABASE_URL=postgresql://sms_user:sms_pass@db:5432/school_sms \
      alembic upgrade head
    " && ok "Migrations complete." || warn "Migration had issues — check output above."
  else
    info "Running Alembic migrations..."
    cd backend
    alembic upgrade head && ok "Migrations complete." || warn "Migration had issues."
    cd ..
  fi
fi

# ── 6. API health check ───────────────────────────────────────────────────
section "API Health Check"

sleep 2  # Give backend a moment
HEALTH_RESPONSE=$(curl -sf "http://localhost:8000/health" 2>/dev/null || echo '{"status":"unreachable"}')
echo "  Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"db_connected": true\|"db_connected":true'; then
  ok "API is up and DB is connected. ✅"
elif echo "$HEALTH_RESPONSE" | grep -q '"db_connected": false\|"db_connected":false'; then
  error "API is up but DB is NOT connected. ❌"
  error "Check backend logs: docker-compose logs backend | tail -40"
  exit 1
else
  warn "Could not reach API at http://localhost:8000/health"
  warn "Is the backend running? Check: docker-compose ps"
fi

# ── 7. Summary ────────────────────────────────────────────────────────────
section "Summary"

echo ""
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo "  Frontend:  http://localhost"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo "  DB Health: http://localhost:8000/health"
echo ""
echo "  First time? Create the admin user:"
echo "    curl -X POST http://localhost:8000/api/v1/auth/register \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"name\":\"Admin\",\"email\":\"admin@iqraschool.in\",\"password\":\"admin123\",\"role\":\"admin\"}'"
echo ""
echo "  Seed classes + academic year:"
echo "    TOKEN=\$(curl -s -X POST http://localhost:8000/api/v1/auth/login \\"
echo "      -d 'username=admin@iqraschool.in&password=admin123' \\"
echo "      -H 'Content-Type: application/x-www-form-urlencoded' | python3 -c \"import sys,json; print(json.load(sys.stdin)['access_token'])\")"
echo "    curl -X POST http://localhost:8000/api/v1/setup/seed -H \"Authorization: Bearer \$TOKEN\""
echo ""
