#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup.sql.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "Restoring from $BACKUP_FILE..."

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gzip -dc "$BACKUP_FILE" | docker exec -i sms_db psql -U sms_user -d school_sms
else
  cat "$BACKUP_FILE" | docker exec -i sms_db psql -U sms_user -d school_sms
fi

echo "Restore complete"
