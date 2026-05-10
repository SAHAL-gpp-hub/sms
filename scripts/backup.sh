#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/opt/backups"
BACKUP_FILE="$BACKUP_DIR/school_sms_${TIMESTAMP}.sql.gz"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
B2_BUCKET_PATH="${B2_BUCKET_PATH:-b2://iqra-school-backups/db/}"

mkdir -p "$BACKUP_DIR"

echo "[$TIMESTAMP] Starting backup..."

if ! docker exec sms_db pg_dump -U sms_user school_sms | gzip > "$BACKUP_FILE"; then
  echo "[$TIMESTAMP] Backup failed"
  exit 1
fi

if [ ! -s "$BACKUP_FILE" ]; then
  echo "[$TIMESTAMP] Backup file is empty: $BACKUP_FILE"
  exit 1
fi

chmod 600 "$BACKUP_FILE"

echo "[$TIMESTAMP] Backup saved: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

deleted_count="$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$BACKUP_RETENTION_DAYS" -print -delete | wc -l)"
echo "[$TIMESTAMP] Old backups cleaned ($deleted_count removed)"

if command -v b2 >/dev/null 2>&1; then
  if b2 sync "$BACKUP_DIR" "$B2_BUCKET_PATH"; then
    echo "[$TIMESTAMP] Synced to Backblaze B2"
  else
    echo "[$TIMESTAMP] Backblaze B2 sync failed"
  fi
fi

echo "[$TIMESTAMP] Backup complete"
