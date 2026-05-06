#!/bin/bash
# setup_sms.sh (DOCKER VERSION)

set -e

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║           SMS SYSTEM - AUTOMATED SETUP & DATA INJECTION            ║"
echo "╚════════════════════════════════════════════════════════════════════╝"

echo ""
echo "🐳 Step 1: Starting Docker containers..."
docker-compose up -d --build
echo "✓ Containers started"

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 5

echo ""
echo "🗄️  Step 2: Running Alembic migrations..."

# IMPORTANT: your alembic folder is backend/migrations
docker-compose exec backend alembic upgrade head

echo "✓ Migrations completed"

echo ""
echo "🌱 Step 3: Injecting test data..."

docker-compose exec backend python scripts/seed_sms_data.py

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                    ✨ SETUP COMPLETE ✨                            ║"
echo "╚════════════════════════════════════════════════════════════════════╝"

echo ""
echo "🚀 Next steps:"
echo "   1. Backend running at: http://localhost:8000"
echo "   2. Frontend at:        http://localhost:3000"
echo ""