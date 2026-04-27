#!/usr/bin/env bash
# =============================================================================
# apply_improvements.sh
# Copies all improved frontend files into the SMS project.
# Run from the project root: bash apply_improvements.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="sms-frontend-improved/src"
DEST="frontend/src"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
info() { echo -e "${BLUE}[→]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }

echo -e "${BOLD}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║  SMS Frontend Improvements — Apply Script         ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check we're in the right place
if [ ! -f "docker-compose.yml" ] || [ ! -d "frontend" ]; then
  echo -e "${RED}Error:${NC} Run this script from the project root (where docker-compose.yml lives)"
  exit 1
fi

# Backup existing frontend/src
BACKUP_DIR="frontend/src.bak.$(date +%Y%m%d_%H%M%S)"
info "Backing up existing frontend/src to $BACKUP_DIR ..."
cp -r "$DEST" "$BACKUP_DIR"
ok "Backup created at $BACKUP_DIR"

echo ""
echo -e "${BOLD}Applying improved files...${NC}"

# Services
cp "$SRC/services/auth.js" "$DEST/services/auth.js"
ok "services/auth.js — sessionStorage token persistence (fix: refresh kills session)"

cp "$SRC/services/api.js"  "$DEST/services/api.js"
ok "services/api.js  — auto-logout on 401, extractError(), fixed imports"

# CSS
cp "$SRC/index.css" "$DEST/index.css"
ok "index.css       — complete design system with CSS variables, skeleton, table styles"

# Components
cp "$SRC/components/Layout.jsx"  "$DEST/components/Layout.jsx"
ok "Layout.jsx      — dark top bar on mobile, page fade-in animation"

cp "$SRC/components/Sidebar.jsx" "$DEST/components/Sidebar.jsx"
ok "Sidebar.jsx     — dark sidebar, grouped nav, dynamic year label"

cp "$SRC/components/UI.jsx" "$DEST/components/UI.jsx"
ok "UI.jsx          — NEW: Skeleton, ConfirmModal, PageHeader, StatCard, TabBar, etc."

# Root
cp "$SRC/App.jsx"  "$DEST/App.jsx"
ok "App.jsx         — updated imports, styled Toaster"

cp "$SRC/main.jsx" "$DEST/main.jsx"
ok "main.jsx        — cleaned up"

# Pages
cp "$SRC/pages/Login.jsx"   "$DEST/pages/Login.jsx"
ok "Login.jsx       — show-password toggle, dark glass design, better error display"

cp "$SRC/pages/Dashboard.jsx" "$DEST/pages/Dashboard.jsx"
ok "Dashboard.jsx   — skeleton loading, progress bars, retry on error, quick actions"

cp "$SRC/pages/students/StudentList.jsx" "$DEST/pages/students/StudentList.jsx"
ok "StudentList.jsx — ConfirmModal replaces confirm(), skeleton table, row count"

cp "$SRC/pages/students/StudentForm.jsx" "$DEST/pages/students/StudentForm.jsx"
ok "StudentForm.jsx — FIXED: aadhar→aadhar_last4 (was sending wrong field!), toast errors"

cp "$SRC/pages/fees/FeeStructure.jsx" "$DEST/pages/fees/FeeStructure.jsx"
ok "FeeStructure.jsx— FIXED: alert()→toast, ConfirmModal for delete, assigning feedback"

cp "$SRC/pages/fees/Defaulters.jsx" "$DEST/pages/fees/Defaulters.jsx"
ok "Defaulters.jsx  — FIXED: class_name resolved from class_id (was always undefined!)"

cp "$SRC/pages/fees/StudentFees.jsx" "$DEST/pages/fees/StudentFees.jsx"
ok "StudentFees.jsx — FIXED: alert()→toast, PaymentModal, progress bar, ledger UX"

cp "$SRC/pages/marks/MarksEntry.jsx" "$DEST/pages/marks/MarksEntry.jsx"
ok "MarksEntry.jsx  — FIXED: alert()→toast, sticky columns, grade badges, scroll hint"

cp "$SRC/pages/attendance/Attendance.jsx" "$DEST/pages/attendance/Attendance.jsx"
ok "Attendance.jsx  — status toggle buttons, summary bar, monthly progress bars"

cp "$SRC/pages/reports/Reports.jsx" "$DEST/pages/reports/Reports.jsx"
ok "Reports.jsx     — card layout, disabled state with hints, all 4 report types"

cp "$SRC/pages/yearend/YearEnd.jsx" "$DEST/pages/yearend/YearEnd.jsx"
ok "YearEnd.jsx     — FIXED: alert()/confirm()→ConfirmModal+toast, numbered steps, validation"

echo ""
echo -e "${BOLD}Verifying files exist...${NC}"
ERRORS=0
for f in \
  "$DEST/services/auth.js" \
  "$DEST/services/api.js" \
  "$DEST/index.css" \
  "$DEST/components/Layout.jsx" \
  "$DEST/components/Sidebar.jsx" \
  "$DEST/components/UI.jsx" \
  "$DEST/App.jsx" \
  "$DEST/main.jsx" \
  "$DEST/pages/Login.jsx" \
  "$DEST/pages/Dashboard.jsx" \
  "$DEST/pages/students/StudentList.jsx" \
  "$DEST/pages/students/StudentForm.jsx" \
  "$DEST/pages/fees/FeeStructure.jsx" \
  "$DEST/pages/fees/Defaulters.jsx" \
  "$DEST/pages/fees/StudentFees.jsx" \
  "$DEST/pages/marks/MarksEntry.jsx" \
  "$DEST/pages/attendance/Attendance.jsx" \
  "$DEST/pages/reports/Reports.jsx" \
  "$DEST/pages/yearend/YearEnd.jsx"
do
  if [ -f "$f" ]; then
    ok "$f"
  else
    echo -e "${RED}[✗] MISSING: $f${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo -e "\n${RED}$ERRORS file(s) missing. Check errors above.${NC}"
  exit 1
fi

echo ""
echo -e "${BOLD}Bug Fixes Applied Summary:${NC}"
echo "  🔴 CRITICAL: aadhar field sent as 'aadhar' (12-digit) — now correctly 'aadhar_last4' (4-digit)"
echo "  🔴 CRITICAL: Defaulters class name was always undefined — now resolved from class_id"
echo "  🔴 CRITICAL: All alert()/confirm() replaced with toast/ConfirmModal (works on mobile)"
echo "  🔴 CRITICAL: JWT token lost on page refresh — now persisted in sessionStorage"
echo "  🟡 MAJOR:    Auto-logout on 401 (expired token) added to axios interceptor"
echo "  🟡 MAJOR:    Fee assignment 'assign to students' had no user feedback on 0 results"
echo "  🟡 MAJOR:    StudentFees payment modal now uses proper modal, not browser alert"
echo "  🟢 MINOR:    Year label in sidebar now fetched dynamically from API"
echo "  🟢 MINOR:    Marks grid now has sticky first column for large classes"
echo "  🟢 MINOR:    Login page has show/hide password toggle"
echo "  🟢 MINOR:    All pages now have skeleton loading states"
echo "  🟢 MINOR:    Empty states with proper icons and CTAs on all pages"
echo "  🟢 MINOR:    ConfirmModal prevents accidental deletes across all delete actions"

echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo "  1. Rebuild the frontend Docker image:"
echo "     docker-compose build frontend"
echo "     docker-compose up -d"
echo ""
echo "  2. Or for local dev with hot reload:"
echo "     cd frontend && npm run dev"
echo ""
echo "  3. Verify the app at http://localhost (Docker) or http://localhost:5173 (dev)"
echo ""
echo -e "${GREEN}${BOLD}All improvements applied successfully! ✅${NC}"
echo ""
echo "If you need to rollback, restore from backup:"
echo "  rm -rf frontend/src && mv $BACKUP_DIR frontend/src"
echo ""
