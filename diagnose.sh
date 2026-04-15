#!/bin/bash
# Run this from /Users/mohammad/school-sms
# Diagnoses backend connection issues

echo "=== 1. Container status ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== 2. Backend logs (last 30 lines) ==="
docker logs sms_backend --tail 30

echo ""
echo "=== 3. DB connection test ==="
docker exec sms_db pg_isready -U sms_user -d school_sms

echo ""
echo "=== 4. Backend health check ==="
curl -s http://localhost:8000/health || echo "FAILED - backend not responding"

echo ""
echo "=== 5. Dashboard stats endpoint ==="
# First get a token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=admin@iqraschool.in&password=admin123" \
  -H "Content-Type: application/x-www-form-urlencoded" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token','NO_TOKEN'))")

echo "Token obtained: ${TOKEN:0:20}..."
curl -s http://localhost:8000/api/v1/attendance/dashboard-stats \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "Request failed"
