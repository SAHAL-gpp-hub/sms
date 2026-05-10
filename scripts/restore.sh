#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup.sql.gz|backup.sql> [--yes]"
  exit 1
fi

ASSUME_YES="${2:-}"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [ "$ASSUME_YES" != "--yes" ]; then
  read -r -p "WARNING: This will overwrite database school_sms. Continue? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Restore aborted"
    exit 1
  fi
fi

echo "Restoring from $BACKUP_FILE..."

if [[ "$BACKUP_FILE" == *.gz ]]; then
  if ! gzip -dc "$BACKUP_FILE" | docker exec -i sms_db psql -U sms_user -d school_sms; then
    echo "Restore failed"
    exit 1
  fi
else
  if ! cat "$BACKUP_FILE" | docker exec -i sms_db psql -U sms_user -d school_sms; then
    echo "Restore failed"
    exit 1
  fi
fi

echo "Restore complete"
