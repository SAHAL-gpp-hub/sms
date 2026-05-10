#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups/runtime"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/sms_backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

cd "$ROOT_DIR"
docker compose exec -T db pg_dump -U sms_user -d school_sms > "$OUT_FILE"

echo "Backup created: $OUT_FILE"
