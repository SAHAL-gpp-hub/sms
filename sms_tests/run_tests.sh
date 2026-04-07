#!/usr/bin/env bash
# ─────────────────────────────────────────────
# run_tests.sh — SMS Test Suite Master Runner
# ─────────────────────────────────────────────
# Usage:
#   ./run_tests.sh                  # Run all tests
#   ./run_tests.sh --api-only       # Only API tests (fast, no browser)
#   ./run_tests.sh --ui-only        # Only UI/browser tests
#   ./run_tests.sh -k students      # Run tests matching 'students'
#   ./run_tests.sh --module fees    # Run only fees module
# ─────────────────────────────────────────────

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SMS Automated Test Suite               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Parse Arguments ──────────────────────────
API_ONLY=false
UI_ONLY=false
KEYWORD=""
MODULE=""
EXTRA_ARGS=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --api-only)   API_ONLY=true ;;
        --ui-only)    UI_ONLY=true ;;
        -k)           KEYWORD="$2"; shift ;;
        --module)     MODULE="$2"; shift ;;
        *)            EXTRA_ARGS="$EXTRA_ARGS $1" ;;
    esac
    shift
done

# ── Build pytest markers ──────────────────────
MARKERS=""
if [ "$API_ONLY" = true ]; then
    MARKERS="-m api"
    echo -e "${YELLOW}Mode: API tests only${NC}"
elif [ "$UI_ONLY" = true ]; then
    MARKERS="-m ui"
    echo -e "${YELLOW}Mode: UI browser tests only${NC}"
fi

if [ -n "$KEYWORD" ]; then
    MARKERS="$MARKERS -k $KEYWORD"
    echo -e "${YELLOW}Keyword filter: $KEYWORD${NC}"
fi

if [ -n "$MODULE" ]; then
    MARKERS="$MARKERS -m $MODULE"
    echo -e "${YELLOW}Module filter: $MODULE${NC}"
fi

# ── Step 1: Setup environment ─────────────────
echo ""
echo -e "${BLUE}[1/4] Setting up environment...${NC}"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  Created virtual environment"
fi

source venv/bin/activate
pip install -q -r requirements.txt
echo -e "  ${GREEN}Dependencies installed ✓${NC}"

# Install Playwright browsers if needed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo "  Installing Playwright browsers..."
    playwright install chromium
fi

# ── Step 2: Check SMS service is running ─────
echo ""
echo -e "${BLUE}[2/4] Checking SMS services...${NC}"

BASE_URL="${BASE_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost}"

if curl -sf "$BASE_URL/docs" > /dev/null 2>&1; then
    echo -e "  ${GREEN}Backend ($BASE_URL) ✓${NC}"
else
    echo -e "  ${RED}Backend ($BASE_URL) not reachable!${NC}"
    echo "  Start with: docker-compose up -d"
    echo "  Continuing anyway (tests will show connection errors)..."
fi

if curl -sf "$FRONTEND_URL" > /dev/null 2>&1; then
    echo -e "  ${GREEN}Frontend ($FRONTEND_URL) ✓${NC}"
else
    echo -e "  ${YELLOW}Frontend ($FRONTEND_URL) not reachable (UI tests will skip/fail)${NC}"
fi

# ── Step 3: Run tests ─────────────────────────
echo ""
echo -e "${BLUE}[3/4] Running tests...${NC}"
mkdir -p reports

set +e  # Don't exit on test failure — we want the report
pytest $MARKERS $EXTRA_ARGS --tb=short -v 2>&1 | tee reports/pytest_output.txt
PYTEST_EXIT=$?
set -e

# ── Step 4: Generate checklist ────────────────
echo ""
echo -e "${BLUE}[4/4] Generating checklist report...${NC}"
python checklist_runner.py --output reports/checklist.html

# ── Summary ───────────────────────────────────
echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Reports Generated:${NC}"
echo -e "  📊 Pytest HTML:   reports/report.html"
echo -e "  ✅ Checklist:     reports/checklist.html"
echo -e "  📄 Raw JSON:      reports/report.json"
echo -e "  📝 Console log:   reports/pytest_output.txt"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"

if [ $PYTEST_EXIT -eq 0 ]; then
    echo -e "${GREEN}  All tests PASSED! 🎉${NC}"
elif [ $PYTEST_EXIT -eq 1 ]; then
    echo -e "${RED}  Some tests FAILED. See reports above.${NC}"
else
    echo -e "${YELLOW}  Test run had errors (exit code $PYTEST_EXIT).${NC}"
fi
echo ""

exit $PYTEST_EXIT
