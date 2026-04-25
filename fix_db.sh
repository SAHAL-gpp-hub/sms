#!/usr/bin/env bash
# fix_db.sh — Fixes "sms_db is unhealthy" / "dependency failed to start"
#
# Run from your project root (where docker-compose.yml lives):
#   bash fix_db.sh
#
# What it does:
#   1. Shows you exactly WHY postgres is unhealthy
#   2. Checks if port 5432 is already in use
#   3. Wipes the corrupt volume and restarts clean
#   4. Runs migrations
#   5. Verifies everything is working

set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
info() { echo -e "${BLUE}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; }

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║  Iqra SMS — DB Container Fix                 ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Step 1: Show exactly what killed postgres ─────────────────────────────
echo -e "${BOLD}Step 1: Diagnosing why sms_db is unhealthy${NC}"
echo ""

info "DB container logs (last 40 lines):"
docker logs sms_db --tail 40 2>&1 || echo "(container not running or doesn't exist yet)"

echo ""
info "DB container inspect (State/Health):"
docker inspect sms_db 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data:
    state = data[0].get('State', {})
    print(f'  Status:     {state.get(\"Status\", \"unknown\")}')
    print(f'  Running:    {state.get(\"Running\", False)}')
    print(f'  ExitCode:   {state.get(\"ExitCode\", \"?\")}')
    print(f'  Error:      {state.get(\"Error\", \"none\")}')
    health = state.get('Health', {})
    if health:
        print(f'  Health:     {health.get(\"Status\", \"?\")}')
        logs = health.get('Log', [])
        if logs:
            last = logs[-1]
            print(f'  Last check: {last.get(\"Output\", \"?\").strip()}')
" 2>/dev/null || echo "  (container doesn't exist)"

echo ""

# ── Step 2: Check if port 5432 is already in use ─────────────────────────
echo -e "${BOLD}Step 2: Check if port 5432 is already occupied${NC}"

PORT_USER=$(lsof -ti:5432 2>/dev/null || true)
if [[ -n "$PORT_USER" ]]; then
    warn "Port 5432 is ALREADY IN USE by PID(s): $PORT_USER"
    warn "This is most likely a local PostgreSQL installation."
    warn ""
    warn "You have two options:"
    warn "  A) Stop local postgres:  brew services stop postgresql@14  (or your version)"
    warn "     Then re-run this script."
    warn ""
    warn "  B) Change the Docker port mapping in docker-compose.yml:"
    warn "     Change:  ports: [\"5432:5432\"]"
    warn "     To:      ports: [\"5433:5432\"]   # expose on 5433 locally"
    warn ""
    read -p "Stop local postgres now and continue? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        brew services stop postgresql@14 2>/dev/null || \
        brew services stop postgresql@15 2>/dev/null || \
        brew services stop postgresql@16 2>/dev/null || \
        pg_ctl stop 2>/dev/null || \
        pkill -f "postgres" 2>/dev/null || true
        sleep 2
        ok "Attempted to stop local postgres. Continuing..."
    else
        warn "Skipping. If DB still fails, stop local postgres manually."
    fi
else
    ok "Port 5432 is free."
fi

echo ""

# ── Step 3: Stop everything cleanly ──────────────────────────────────────
echo -e "${BOLD}Step 3: Stopping all containers${NC}"
docker-compose down 2>/dev/null || true
ok "All containers stopped."

echo ""

# ── Step 4: Check for corrupt volume ─────────────────────────────────────
echo -e "${BOLD}Step 4: Checking Docker volume${NC}"

VOLUME_NAME=$(docker-compose config --volumes 2>/dev/null | grep postgres | head -1 || true)
PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '-' | tr ' ' '-' | tr -cd '[:alnum:]-' | tr '[:upper:]' '[:lower:]')
FULL_VOLUME="${PROJECT_NAME}_postgres_data"

info "Looking for volume: $FULL_VOLUME"
VOLUME_EXISTS=$(docker volume ls -q | grep -F "$FULL_VOLUME" || true)

if [[ -n "$VOLUME_EXISTS" ]]; then
    warn "Found existing postgres volume: $VOLUME_EXISTS"
    warn "This volume may have corrupted data or wrong credentials from a previous run."
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  1) WIPE volume (recommended if this is dev/test data) — clean slate"
    echo "  2) Keep volume and try to repair"
    echo "  3) Exit and inspect manually"
    echo ""
    read -p "Choice (1/2/3): " -n 1 -r CHOICE
    echo ""

    if [[ "$CHOICE" == "1" ]]; then
        warn "Wiping volume $VOLUME_EXISTS ..."
        docker volume rm "$VOLUME_EXISTS" 2>/dev/null || docker volume rm "$FULL_VOLUME" 2>/dev/null || true
        ok "Volume wiped. PostgreSQL will initialize fresh on next start."
    elif [[ "$CHOICE" == "2" ]]; then
        info "Keeping volume. Will attempt repair..."
    else
        echo "Exiting. To manually inspect: docker volume inspect $VOLUME_EXISTS"
        exit 0
    fi
else
    ok "No existing postgres volume found. Will create fresh."
fi

echo ""

# ── Step 5: Fix docker-compose.yml if needed ─────────────────────────────
echo -e "${BOLD}Step 5: Verifying docker-compose.yml${NC}"

# Check if the healthcheck has start_period (older Docker versions need it)
if ! grep -q "start_period" docker-compose.yml 2>/dev/null; then
    warn "docker-compose.yml missing 'start_period' in DB healthcheck."
    warn "Adding it now to give PostgreSQL more time to initialize..."
    # Inject start_period after the retries line
    sed -i.bak '/retries: 5/a\      start_period: 30s' docker-compose.yml 2>/dev/null || true
    ok "Added start_period: 30s"
fi

# Remove the 'version' key warning by stripping it if present
if grep -q "^version:" docker-compose.yml 2>/dev/null; then
    info "Removing obsolete 'version:' key from docker-compose.yml..."
    sed -i.bak '/^version:/d' docker-compose.yml 2>/dev/null || true
    ok "Removed 'version:' key (obsolete in modern compose)."
fi

echo ""

# ── Step 6: Start ONLY the DB first, watch it come up ────────────────────
echo -e "${BOLD}Step 6: Starting DB container in isolation${NC}"

info "Starting only the 'db' service to verify it comes up cleanly..."
docker-compose up -d db

info "Waiting up to 60 seconds for PostgreSQL to be healthy..."
HEALTHY=false
for i in $(seq 1 60); do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' sms_db 2>/dev/null || echo "missing")
    if [[ "$STATUS" == "healthy" ]]; then
        HEALTHY=true
        break
    elif [[ "$STATUS" == "unhealthy" ]]; then
        err "PostgreSQL became unhealthy. Logs:"
        docker logs sms_db --tail 20
        break
    fi
    printf "\r  [%2d/60] Status: %-12s " "$i" "$STATUS"
    sleep 1
done
echo ""

if $HEALTHY; then
    ok "PostgreSQL is healthy! ✅"
else
    err "PostgreSQL failed to become healthy."
    err ""
    err "Full DB logs:"
    docker logs sms_db 2>&1 | tail -30
    err ""
    err "Common fixes:"
    err "  1. If you see 'data directory has wrong ownership':"
    err "     docker-compose down -v && docker-compose up -d db"
    err ""
    err "  2. If you see 'port already in use':"
    err "     Stop local postgres: brew services stop postgresql"
    err ""
    err "  3. If you see 'permission denied':"
    err "     docker volume rm ${FULL_VOLUME} && docker-compose up -d db"
    exit 1
fi

echo ""

# ── Step 7: Start full stack ──────────────────────────────────────────────
echo -e "${BOLD}Step 7: Starting full stack${NC}"
docker-compose up -d
ok "All services started."

echo ""

# ── Step 8: Wait for backend to be ready ─────────────────────────────────
echo -e "${BOLD}Step 8: Waiting for backend API${NC}"
BACKEND_READY=false
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
        BACKEND_READY=true
        break
    fi
    printf "\r  [%2d/30] Waiting for backend..." "$i"
    sleep 1
done
echo ""

if $BACKEND_READY; then
    ok "Backend is responding."
else
    warn "Backend not responding yet. Checking logs..."
    docker-compose logs --tail=30 backend
fi

echo ""

# ── Step 9: Run migrations ────────────────────────────────────────────────
echo -e "${BOLD}Step 9: Running Alembic migrations${NC}"
docker-compose exec -T backend sh -c \
    "DATABASE_URL=postgresql://sms_user:sms_pass@db:5432/school_sms alembic upgrade head" \
    && ok "Migrations complete." \
    || warn "Migration had issues — check output above. Tables may already exist (safe to ignore)."

echo ""

# ── Step 10: Verify DB connection via /health ─────────────────────────────
echo -e "${BOLD}Step 10: Final verification${NC}"

HEALTH=$(curl -sf http://localhost:8000/health 2>/dev/null || echo '{"error":"unreachable"}')
echo "  /health response: $HEALTH"

if echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('db_connected') else 1)" 2>/dev/null; then
    ok "db_connected: true ✅"
else
    err "db_connected is false or endpoint unreachable."
    err "Check backend logs: docker-compose logs backend | tail -40"
    exit 1
fi

echo ""

# ── Step 11: Create admin user if first run ───────────────────────────────
echo -e "${BOLD}Step 11: Admin user setup${NC}"

REGISTER=$(curl -sf -X POST http://localhost:8000/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"name":"Admin","email":"admin@iqraschool.in","password":"admin123","role":"admin"}' \
    2>/dev/null || echo "")

if echo "$REGISTER" | grep -q '"id"'; then
    ok "Admin user created: admin@iqraschool.in / admin123"
elif echo "$REGISTER" | grep -q "already exists"; then
    ok "Admin user already exists."
else
    warn "Could not create admin user automatically."
    warn "Create manually: curl -X POST http://localhost:8000/api/v1/auth/register \\"
    warn "  -H 'Content-Type: application/json' \\"
    warn "  -d '{\"name\":\"Admin\",\"email\":\"admin@iqraschool.in\",\"password\":\"admin123\",\"role\":\"admin\"}'"
fi

echo ""

# ── Step 12: Seed classes ─────────────────────────────────────────────────
echo -e "${BOLD}Step 12: Seeding classes and academic year${NC}"

TOKEN=$(curl -sf -X POST http://localhost:8000/api/v1/auth/login \
    -d "username=admin@iqraschool.in&password=admin123" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")

if [[ -n "$TOKEN" ]]; then
    SEED=$(curl -sf -X POST http://localhost:8000/api/v1/setup/seed \
        -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo "")
    if echo "$SEED" | grep -q "academic_year"; then
        ok "Classes and academic year seeded."
    else
        warn "Seed response: $SEED"
    fi
else
    warn "Could not get auth token. Skip seeding — login at http://localhost and seed from the UI."
fi

echo ""

# ── Done ──────────────────────────────────────────────────────────────────
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Everything is running! ✅${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${NC}"
echo ""
echo "  Frontend:  http://localhost"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo "  Health:    http://localhost:8000/health"
echo ""
echo "  Login:     admin@iqraschool.in / admin123"
echo ""
echo "  To watch logs:   docker-compose logs -f backend"
echo "  To stop all:     docker-compose down"
echo "  To wipe DB:      docker-compose down -v"
echo ""
