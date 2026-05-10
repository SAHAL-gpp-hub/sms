#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /absolute/path/to/backup.sql"
  exit 1
fi

ROOT_DIR="/home/runner/work/sms/sms"
BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

cd "$ROOT_DIR"
cat "$BACKUP_FILE" | docker compose exec -T db psql -U sms_user -d school_sms

echo "Restore complete from: $BACKUP_FILE"
