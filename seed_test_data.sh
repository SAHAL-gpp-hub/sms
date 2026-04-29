#!/usr/bin/env bash
# =============================================================================
# seed_test_data.sh — Full test data seed for Iqra School SMS
# Run from project root: bash seed_test_data.sh
# =============================================================================

set -euo pipefail

BASE="http://localhost:8000/api/v1"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
info() { echo -e "${BLUE}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   Iqra SMS — Full Test Data Seed                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# STEP 0 — Create admin user
# =============================================================================
info "Step 0: Creating admin user..."
docker compose exec -T backend python3 -c "
import sys; sys.path.insert(0, '/app')
from app.core.database import SessionLocal
from app.models.base_models import User
from app.core.security import get_password_hash
db = SessionLocal()
if db.query(User).filter_by(email='admin@iqraschool.in').first():
    print('Admin already exists')
else:
    db.add(User(name='Admin', email='admin@iqraschool.in',
                password_hash=get_password_hash('admin123'),
                role='admin', is_active=True))
    db.commit()
    print('Admin created')
db.close()
"

# =============================================================================
# STEP 1 — Get auth token
# =============================================================================
info "Step 1: Getting auth token..."
TOKEN=$(curl -sf -X POST "$BASE/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@iqraschool.in&password=admin123" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

ok "Token obtained"

AUTH="-H \"Authorization: Bearer $TOKEN\" -H \"Content-Type: application/json\""

# Helper — POST and return id
post() {
  local url=$1; local body=$2
  curl -sf -X POST "$BASE$url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d))"
}

get() {
  local url=$1
  curl -sf "$BASE$url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json"
}

# =============================================================================
# STEP 2 — Seed classes + academic year
# =============================================================================
info "Step 2: Seeding classes and academic year..."
SEED=$(curl -sf -X POST "$BASE/setup/seed" \
  -H "Authorization: Bearer $TOKEN")
YEAR_ID=$(echo $SEED | python3 -c "import sys,json; print(json.load(sys.stdin).get('academic_year',''))" 2>/dev/null || echo "")
ok "Classes seeded — Academic Year 2025-26"

# Get class IDs
CLASSES=$(get "/setup/classes")
CLASS_7=$(echo $CLASSES | python3 -c "import sys,json; cs=json.load(sys.stdin); print(next(c['id'] for c in cs if c['name']=='7'))")
CLASS_5=$(echo $CLASSES | python3 -c "import sys,json; cs=json.load(sys.stdin); print(next(c['id'] for c in cs if c['name']=='5'))")
CLASS_10=$(echo $CLASSES | python3 -c "import sys,json; cs=json.load(sys.stdin); print(next(c['id'] for c in cs if c['name']=='10'))")
YEAR_ID=$(echo $CLASSES | python3 -c "import sys,json; cs=json.load(sys.stdin); print(cs[0]['academic_year_id'])")
ok "Class 5 ID=$CLASS_5 | Class 7 ID=$CLASS_7 | Class 10 ID=$CLASS_10 | Year ID=$YEAR_ID"

# =============================================================================
# STEP 3 — Seed subjects for all 3 classes
# =============================================================================
info "Step 3: Seeding GSEB subjects for Classes 5, 7, 10..."
curl -sf -X POST "$BASE/marks/subjects/seed/$CLASS_5"  -H "Authorization: Bearer $TOKEN" > /dev/null
curl -sf -X POST "$BASE/marks/subjects/seed/$CLASS_7"  -H "Authorization: Bearer $TOKEN" > /dev/null
curl -sf -X POST "$BASE/marks/subjects/seed/$CLASS_10" -H "Authorization: Bearer $TOKEN" > /dev/null
ok "Subjects seeded"

# Add a custom subject to Class 7
COMP_ID=$(post "/marks/subjects" "{\"name\":\"Computer Science\",\"class_id\":$CLASS_7,\"max_theory\":50,\"max_practical\":0,\"subject_type\":\"Theory\"}")
ok "Added Computer Science (id=$COMP_ID) to Class 7"

# =============================================================================
# STEP 4 — Add students to Class 7
# =============================================================================
info "Step 4: Adding 6 students to Class 7..."

S1=$(post "/students/" "{
  \"name_en\":\"Aryan Patel\",\"name_gu\":\"આર્યન પટેલ\",
  \"dob\":\"2012-04-15\",\"gender\":\"M\",\"class_id\":$CLASS_7,
  \"roll_number\":1,\"gr_number\":\"GR2025001\",\"father_name\":\"Ramesh Patel\",
  \"mother_name\":\"Sunita Patel\",\"contact\":\"9876543201\",
  \"address\":\"12 Gandhi Nagar, Palanpur\",\"category\":\"GEN\",
  \"admission_date\":\"2025-06-01\",\"academic_year_id\":$YEAR_ID
}")

S2=$(post "/students/" "{
  \"name_en\":\"Zoya Sheikh\",\"name_gu\":\"ઝોયા શેખ\",
  \"dob\":\"2012-07-22\",\"gender\":\"F\",\"class_id\":$CLASS_7,
  \"roll_number\":2,\"gr_number\":\"GR2025002\",\"father_name\":\"Imran Sheikh\",
  \"mother_name\":\"Fatima Sheikh\",\"contact\":\"9876543202\",
  \"address\":\"45 Nehru Road, Palanpur\",\"category\":\"OBC\",
  \"admission_date\":\"2025-06-01\",\"academic_year_id\":$YEAR_ID
}")

S3=$(post "/students/" "{
  \"name_en\":\"Dhruv Sharma\",\"name_gu\":\"ધ્રુવ શર્મા\",
  \"dob\":\"2012-01-10\",\"gender\":\"M\",\"class_id\":$CLASS_7,
  \"roll_number\":3,\"gr_number\":\"GR2025003\",\"father_name\":\"Vikram Sharma\",
  \"mother_name\":\"Priya Sharma\",\"contact\":\"9876543203\",
  \"address\":\"8 Station Road, Palanpur\",\"category\":\"GEN\",
  \"admission_date\":\"2025-06-01\",\"academic_year_id\":$YEAR_ID
}")

S4=$(post "/students/" "{
  \"name_en\":\"Nisha Joshi\",\"name_gu\":\"નિશા જોશી\",
  \"dob\":\"2012-09-05\",\"gender\":\"F\",\"class_id\":$CLASS_7,
  \"roll_number\":4,\"gr_number\":\"GR2025004\",\"father_name\":\"Mahesh Joshi\",
  \"mother_name\":\"Rekha Joshi\",\"contact\":\"9876543204\",
  \"address\":\"22 Ambaji Road, Palanpur\",\"category\":\"GEN\",
  \"admission_date\":\"2025-06-01\",\"academic_year_id\":$YEAR_ID
}")

S5=$(post "/students/" "{
  \"name_en\":\"Kabir Ansari\",\"name_gu\":\"કબીર અન્સારી\",
  \"dob\":\"2012-11-30\",\"gender\":\"M\",\"class_id\":$CLASS_7,
  \"roll_number\":5,\"gr_number\":\"GR2025005\",\"father_name\":\"Salim Ansari\",
  \"mother_name\":\"Noor Ansari\",\"contact\":\"9876543205\",
  \"address\":\"67 Bhagat Singh Nagar, Palanpur\",\"category\":\"OBC\",
  \"admission_date\":\"2025-06-01\",\"academic_year_id\":$YEAR_ID
}")

S6=$(post "/students/" "{
  \"name_en\":\"Pooja Rathod\",\"name_gu\":\"પૂજા રાઠોડ\",
  \"dob\":\"2012-03-18\",\"gender\":\"F\",\"class_id\":$CLASS_7,
  \"roll_number\":6,\"gr_number\":\"GR2025006\",\"father_name\":\"Suresh Rathod\",
  \"mother_name\":\"Geeta Rathod\",\"contact\":\"9876543206\",
  \"address\":\"33 Patel Colony, Palanpur\",\"category\":\"SC\",
  \"admission_date\":\"2025-06-01\",\"academic_year_id\":$YEAR_ID
}")

ok "Students created: IDs $S1 $S2 $S3 $S4 $S5 $S6"

# Add 2 students to Class 5
S7=$(post "/students/" "{
  \"name_en\":\"Riya Modi\",\"name_gu\":\"રિયા મોદી\",
  \"dob\":\"2014-06-12\",\"gender\":\"F\",\"class_id\":$CLASS_5,
  \"roll_number\":1,\"gr_number\":\"GR2025007\",\"father_name\":\"Ajay Modi\",
  \"contact\":\"9876543207\",\"address\":\"10 MG Road, Palanpur\",
  \"category\":\"GEN\",\"admission_date\":\"2025-06-01\",\"academic_year_id\":$YEAR_ID
}")
S8=$(post "/students/" "{
  \"name_en\":\"Yash Trivedi\",\"name_gu\":\"યશ ત્રિવેદી\",
  \"dob\":\"2014-08-25\",\"gender\":\"M\",\"class_id\":$CLASS_5,
  \"roll_number\":2,\"gr_number\":\"GR2025008\",\"father_name\":\"Deepak Trivedi\",
  \"contact\":\"9876543208\",\"address\":\"55 Subhash Nagar, Palanpur\",
  \"category\":\"GEN\",\"admission_date\":\"2025-06-01\",\"academic_year_id\":$YEAR_ID
}")
ok "Class 5 students: IDs $S7 $S8"

# =============================================================================
# STEP 5 — Fee structure
# =============================================================================
info "Step 5: Setting up fee structure..."
curl -sf -X POST "$BASE/fees/heads/seed" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
ok "Fee heads seeded"

# Get fee head IDs
HEADS=$(get "/fees/heads")
FH_TUITION=$(echo $HEADS | python3 -c "import sys,json; hs=json.load(sys.stdin); print(next(h['id'] for h in hs if 'Tuition' in h['name']))")
FH_EXAM=$(echo $HEADS | python3 -c "import sys,json; hs=json.load(sys.stdin); print(next(h['id'] for h in hs if 'Exam' in h['name']))")
FH_SPORTS=$(echo $HEADS | python3 -c "import sys,json; hs=json.load(sys.stdin); print(next(h['id'] for h in hs if 'Sports' in h['name']))")
ok "Fee heads — Tuition=$FH_TUITION Exam=$FH_EXAM Sports=$FH_SPORTS"

# Create fee structures for Class 7
post "/fees/structure" "{\"class_id\":$CLASS_7,\"fee_head_id\":$FH_TUITION,\"amount\":1200,\"academic_year_id\":$YEAR_ID}" > /dev/null
post "/fees/structure" "{\"class_id\":$CLASS_7,\"fee_head_id\":$FH_EXAM,\"amount\":500,\"academic_year_id\":$YEAR_ID}" > /dev/null
post "/fees/structure" "{\"class_id\":$CLASS_7,\"fee_head_id\":$FH_SPORTS,\"amount\":300,\"academic_year_id\":$YEAR_ID}" > /dev/null

# Create fee structures for Class 5
post "/fees/structure" "{\"class_id\":$CLASS_5,\"fee_head_id\":$FH_TUITION,\"amount\":1000,\"academic_year_id\":$YEAR_ID}" > /dev/null
post "/fees/structure" "{\"class_id\":$CLASS_5,\"fee_head_id\":$FH_EXAM,\"amount\":400,\"academic_year_id\":$YEAR_ID}" > /dev/null
ok "Fee structures created"

# Assign fees to students
curl -sf -X POST "$BASE/fees/assign/$CLASS_7?academic_year_id=$YEAR_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
curl -sf -X POST "$BASE/fees/assign/$CLASS_5?academic_year_id=$YEAR_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
ok "Fees assigned to all students"

# Record some payments
LEDGER_7_S1=$(get "/fees/ledger/$S1")
SF_ID=$(echo $LEDGER_7_S1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0]['student_fee_id'])")
post "/fees/payment" "{\"student_fee_id\":$SF_ID,\"amount_paid\":1200,\"payment_date\":\"2025-07-01\",\"mode\":\"Cash\",\"collected_by\":\"Admin\"}" > /dev/null

LEDGER_7_S2=$(get "/fees/ledger/$S2")
SF_ID2=$(echo $LEDGER_7_S2 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0]['student_fee_id'])")
post "/fees/payment" "{\"student_fee_id\":$SF_ID2,\"amount_paid\":600,\"payment_date\":\"2025-07-05\",\"mode\":\"UPI\",\"collected_by\":\"Admin\"}" > /dev/null
ok "Payments recorded (S1 full pay, S2 partial pay)"

# =============================================================================
# STEP 6 — Exams
# =============================================================================
info "Step 6: Creating exams for Class 7..."

EXAM_UT1=$(post "/marks/exams" "{\"name\":\"Unit Test 1\",\"class_id\":$CLASS_7,\"academic_year_id\":$YEAR_ID,\"exam_date\":\"2025-08-15\"}")
EXAM_UT2=$(post "/marks/exams" "{\"name\":\"Unit Test 2\",\"class_id\":$CLASS_7,\"academic_year_id\":$YEAR_ID,\"exam_date\":\"2025-10-10\"}")
EXAM_HALF=$(post "/marks/exams" "{\"name\":\"Half-Yearly\",\"class_id\":$CLASS_7,\"academic_year_id\":$YEAR_ID,\"exam_date\":\"2025-11-20\"}")
EXAM_ANNUAL=$(post "/marks/exams" "{\"name\":\"Annual\",\"class_id\":$CLASS_7,\"academic_year_id\":$YEAR_ID,\"exam_date\":\"2026-03-10\"}")
ok "Exams created: UT1=$EXAM_UT1 UT2=$EXAM_UT2 Half=$EXAM_HALF Annual=$EXAM_ANNUAL"

EXAM_UT1_C5=$(post "/marks/exams" "{\"name\":\"Unit Test 1\",\"class_id\":$CLASS_5,\"academic_year_id\":$YEAR_ID,\"exam_date\":\"2025-08-15\"}")
ok "Class 5 UT1=$EXAM_UT1_C5"

# =============================================================================
# STEP 7 — Exam subject configs (custom max marks for Unit Tests)
# =============================================================================
info "Step 7: Setting custom max marks for Unit Test 1 (25 marks each)..."

SUBJECTS_7=$(get "/marks/subjects?class_id=$CLASS_7")
CONFIGS=$(echo $SUBJECTS_7 | python3 -c "
import sys,json
subs = json.load(sys.stdin)
cfgs = [{'subject_id': s['id'], 'max_theory': 25, 'max_practical': 0} for s in subs]
print(json.dumps({'configs': cfgs}))
")

curl -sf -X PUT "$BASE/marks/exams/$EXAM_UT1/configs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CONFIGS" > /dev/null
ok "Unit Test 1: all subjects set to 25 marks"

info "Setting Half-Yearly to 50 marks each..."
CONFIGS_HALF=$(echo $SUBJECTS_7 | python3 -c "
import sys,json
subs = json.load(sys.stdin)
cfgs = [{'subject_id': s['id'], 'max_theory': 50, 'max_practical': 0} for s in subs]
print(json.dumps({'configs': cfgs}))
")
curl -sf -X PUT "$BASE/marks/exams/$EXAM_HALF/configs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CONFIGS_HALF" > /dev/null
ok "Half-Yearly: all subjects set to 50 marks"

# =============================================================================
# STEP 8 — Enter marks for Unit Test 1 (Class 7, 25-mark scale)
# =============================================================================
info "Step 8: Entering marks for Unit Test 1 (Class 7)..."

SUBJECTS_7_IDS=$(echo $SUBJECTS_7 | python3 -c "
import sys,json
subs = json.load(sys.stdin)
print(' '.join(str(s['id']) for s in subs))
")

# Build bulk marks payload — realistic scores out of 25
python3 -c "
import json
students = [$S1, $S2, $S3, $S4, $S5, $S6]
subjects = $(echo $SUBJECTS_7 | python3 -c "import sys,json; print([s['id'] for s in json.load(sys.stdin)])")
exam_id = $EXAM_UT1

# Marks matrix: each student × subject (out of 25)
marks_matrix = {
    $S1: [23, 22, 24, 21, 20, 22, 19],   # Aryan — strong student
    $S2: [18, 20, 17, 22, 19, 21, 20],   # Zoya — average-good
    $S3: [25, 24, 23, 25, 22, 24, 21],   # Dhruv — topper
    $S4: [15, 16, 14, 18, 17, 15, 16],   # Nisha — average
    $S5: [20, 19, 21, 18, 20, 22, 18],   # Kabir — good
    $S6: [12, 14, 11, 13, 10, 12, 14],   # Pooja — weak
}

entries = []
for sid, marks in marks_matrix.items():
    for i, sub_id in enumerate(subjects[:len(marks)]):
        entries.append({
            'student_id': sid,
            'subject_id': sub_id,
            'exam_id': exam_id,
            'theory_marks': marks[i],
            'practical_marks': None,
            'is_absent': False
        })

print(json.dumps(entries))
" | curl -sf -X POST "$BASE/marks/bulk" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @- > /dev/null

ok "Unit Test 1 marks entered for all 6 students"

# =============================================================================
# STEP 9 — Enter marks for Annual exam (Class 7, 100-mark scale — default)
# =============================================================================
info "Step 9: Entering marks for Annual exam (100-mark scale)..."

python3 -c "
import json
students = [$S1, $S2, $S3, $S4, $S5, $S6]
subjects = $(echo $SUBJECTS_7 | python3 -c "import sys,json; print([s['id'] for s in json.load(sys.stdin)])")
exam_id = $EXAM_ANNUAL

marks_matrix = {
    $S1: [85, 78, 88, 72, 80, 76, 69],
    $S2: [70, 74, 65, 82, 71, 79, 73],
    $S3: [95, 92, 91, 98, 88, 94, 87],
    $S4: [55, 58, 52, 61, 59, 54, 57],
    $S5: [76, 72, 79, 68, 77, 83, 71],
    $S6: [42, 48, 39, 45, 38, 41, 46],
}

entries = []
for sid, marks in marks_matrix.items():
    for i, sub_id in enumerate(subjects[:len(marks)]):
        entries.append({
            'student_id': sid,
            'subject_id': sub_id,
            'exam_id': exam_id,
            'theory_marks': marks[i],
            'practical_marks': None,
            'is_absent': False
        })
# Mark S6 absent for one subject
entries.append({
    'student_id': $S6,
    'subject_id': subjects[0],
    'exam_id': exam_id,
    'theory_marks': None,
    'practical_marks': None,
    'is_absent': True
})
print(json.dumps(entries))
" | curl -sf -X POST "$BASE/marks/bulk" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @- > /dev/null

ok "Annual marks entered (S6 marked absent for 1 subject → FAIL result)"

# =============================================================================
# STEP 10 — Attendance (Class 7, last 5 days)
# =============================================================================
info "Step 10: Recording attendance for Class 7..."

python3 -c "
import json
from datetime import date, timedelta

students = [$S1, $S2, $S3, $S4, $S5, $S6]
class_id = $CLASS_7
today = date.today()

# Attendance pattern: mostly present, some absent
patterns = {
    $S1: ['P','P','P','P','P'],
    $S2: ['P','P','A','P','P'],
    $S3: ['P','P','P','P','P'],
    $S4: ['A','P','P','A','P'],
    $S5: ['P','L','P','P','P'],
    $S6: ['A','A','P','A','P'],   # low attendance
}

entries = []
for day_offset in range(5):
    att_date = (today - timedelta(days=4-day_offset)).isoformat()
    for sid, pattern in patterns.items():
        entries.append({
            'student_id': sid,
            'class_id': class_id,
            'date': att_date,
            'status': pattern[day_offset]
        })

print(json.dumps({'entries': entries}))
" | curl -sf -X POST "$BASE/attendance/bulk" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @- > /dev/null

ok "Attendance recorded for last 5 days (S6 has low attendance)"

# =============================================================================
# DONE — Print summary
# =============================================================================
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Test data seeded successfully! ✅${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo ""
echo "  Academic Year : 2025-26  (ID: $YEAR_ID)"
echo "  Classes       : 5 (ID:$CLASS_5)  7 (ID:$CLASS_7)  10 (ID:$CLASS_10)"
echo ""
echo "  Students (Class 7):"
echo "    $S1  Aryan Patel      roll 1"
echo "    $S2  Zoya Sheikh      roll 2"
echo "    $S3  Dhruv Sharma     roll 3  ← expected topper"
echo "    $S4  Nisha Joshi      roll 4"
echo "    $S5  Kabir Ansari     roll 5"
echo "    $S6  Pooja Rathod     roll 6  ← low attendance + will FAIL annual"
echo ""
echo "  Exams (Class 7):"
echo "    $EXAM_UT1    Unit Test 1   → 25 marks (custom config)"
echo "    $EXAM_UT2    Unit Test 2   → 100 marks (default)"
echo "    $EXAM_HALF   Half-Yearly   → 50 marks (custom config)"
echo "    $EXAM_ANNUAL Annual        → 100 marks (default)"
echo ""
echo "  Marks entered : Unit Test 1 ✓  |  Annual ✓"
echo "  Fees          : Class 7 = ₹2000/student assigned"
echo "  Payments      : S1 full paid  |  S2 partial (₹600 of ₹2000)"
echo ""
echo "  Login: admin@iqraschool.in / admin123"
echo "  UI:    http://localhost"
echo "  Docs:  http://localhost:8000/docs"
echo ""
echo "  Quick verify:"
echo "    Results UT1 : curl -s \"$BASE/marks/results?exam_id=$EXAM_UT1&class_id=$CLASS_7\" | python3 -m json.tool"
echo "    Defaulters  : curl -s \"$BASE/fees/defaulters\" -H \"Authorization: Bearer $TOKEN\" | python3 -m json.tool"
echo "    Attendance  : curl -s \"$BASE/attendance/monthly?class_id=$CLASS_7&year=$(date +%Y)&month=$(date +%m)\" -H \"Authorization: Bearer $TOKEN\" | python3 -m json.tool"
echo ""
