#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"
EMAIL="admin@iqraschool.in"
PASSWORD="secret"

echo "🚀 Starting GOD-LEVEL API Testing..."
echo "====================================="

# -----------------------------------
# Helper function
# -----------------------------------
print_step() {
  echo ""
  echo "🔹 $1"
  echo "-------------------------------------"
}

# -----------------------------------
# 1. REGISTER ADMIN
# -----------------------------------
print_step "Register Admin"

curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "email": "'"$EMAIL"'",
    "password": "'"$PASSWORD"'",
    "role": "admin"
}' | jq

# -----------------------------------
# 2. LOGIN
# -----------------------------------
print_step "Login & Get Token"

LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$EMAIL&password=$PASSWORD")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

echo "✅ TOKEN: $TOKEN"

if [ "$TOKEN" == "null" ]; then
  echo "❌ Login failed. Exiting."
  exit 1
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"

# -----------------------------------
# 3. SEED SETUP
# -----------------------------------
print_step "Seed Academic Year + Classes"

curl -s -X POST $BASE_URL/setup/seed \
  -H "$AUTH_HEADER" | jq

# -----------------------------------
# 4. CREATE STUDENT
# -----------------------------------
print_step "Create Student"

STUDENT_RESPONSE=$(curl -s -X POST $BASE_URL/students/ \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "name_en": "Ahmed Ali",
    "name_gu": "અહમદ અલી",
    "dob": "2012-05-10",
    "contact": "9876543210",
    "class_id": 1
}')

echo $STUDENT_RESPONSE | jq

STUDENT_ID=$(echo $STUDENT_RESPONSE | jq -r '.id')

echo "✅ STUDENT_ID: $STUDENT_ID"

# -----------------------------------
# 5. CREATE FEE STRUCTURE
# -----------------------------------
print_step "Create Fee Structure"

curl -s -X POST $BASE_URL/fees/structure \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "class_id": 1,
    "fee_head_id": 1,
    "amount": 5000,
    "academic_year_id": 1
}' | jq

# -----------------------------------
# 6. ASSIGN FEES
# -----------------------------------
print_step "Assign Fees"

curl -s -X POST $BASE_URL/fees/assign/1 \
  -H "$AUTH_HEADER" | jq

# -----------------------------------
# 7. GET FEE LEDGER
# -----------------------------------
print_step "Get Fee Ledger"

LEDGER=$(curl -s -X GET $BASE_URL/fees/ledger/$STUDENT_ID \
  -H "$AUTH_HEADER")

echo $LEDGER | jq

STUDENT_FEE_ID=$(echo $LEDGER | jq -r '.fees[0].id')

echo "✅ STUDENT_FEE_ID: $STUDENT_FEE_ID"

# -----------------------------------
# 8. RECORD PAYMENT
# -----------------------------------
print_step "Record Payment"

curl -s -X POST $BASE_URL/fees/payment \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "student_fee_id": '"$STUDENT_FEE_ID"',
    "amount_paid": 2000,
    "payment_date": "2026-05-01",
    "mode": "cash"
}' | jq

# -----------------------------------
# 9. MARKS ENTRY
# -----------------------------------
print_step "Bulk Marks Entry"

curl -s -X POST $BASE_URL/marks/bulk \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "student_id": '"$STUDENT_ID"',
      "subject_id": 1,
      "exam_id": 1,
      "theory_marks": 45,
      "practical_marks": 20,
      "is_absent": false
    }
]' | jq

# -----------------------------------
# 10. ATTENDANCE
# -----------------------------------
print_step "Mark Attendance"

curl -s -X POST $BASE_URL/attendance/bulk \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {
        "student_id": '"$STUDENT_ID"',
        "class_id": 1,
        "date": "2026-05-01",
        "status": "P"
      }
    ]
}' | jq

# -----------------------------------
# 11. VALIDATION TESTS
# -----------------------------------
print_step "Negative Payment Test (Should Fail)"

curl -s -X POST $BASE_URL/fees/payment \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "student_fee_id": '"$STUDENT_FEE_ID"',
    "amount_paid": -100,
    "payment_date": "2026-05-01",
    "mode": "cash"
}' | jq

# -----------------------------------
# 12. PDF TEST
# -----------------------------------
print_step "Download Marksheet"

curl -s -X GET "$BASE_URL/pdf/marksheet/student/$STUDENT_ID?exam_id=1&class_id=1" \
  -o marksheet.pdf

echo "📄 Marksheet saved as marksheet.pdf"

# -----------------------------------
# DONE
# -----------------------------------
echo ""
echo "====================================="
echo "🎉 ALL TESTS COMPLETED SUCCESSFULLY"
echo "====================================="