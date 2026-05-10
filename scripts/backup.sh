#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/opt/backups"
BACKUP_FILE="$BACKUP_DIR/school_sms_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$TIMESTAMP] Starting backup..."

docker exec sms_db pg_dump -U sms_user school_sms | gzip > "$BACKUP_FILE"

echo "[$TIMESTAMP] Backup saved: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "[$TIMESTAMP] Old backups cleaned"

if command -v b2 >/dev/null 2>&1; then
  b2 sync "$BACKUP_DIR" "b2://iqra-school-backups/db/"
  echo "[$TIMESTAMP] Synced to Backblaze B2"
fi

echo "[$TIMESTAMP] Backup complete"
