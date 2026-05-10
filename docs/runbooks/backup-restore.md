# Runbook: PostgreSQL Backup and Restore

## Backup (VPS production)

```bash
cd /opt/iqra-sms
chmod +x scripts/backup.sh
./scripts/backup.sh
```

The script writes gzip-compressed dumps into `/opt/backups` with 30-day retention.
If `b2` is available, backups are synced to Backblaze B2 automatically.

## Restore

```bash
cd /opt/iqra-sms
chmod +x scripts/restore.sh
./scripts/restore.sh /opt/backups/school_sms_<timestamp>.sql.gz
```

## Legacy local scripts (non-production)

For local Docker-based recovery flows you can continue using:

- `./ops/backup_db.sh`
- `./ops/restore_db.sh <absolute-backup-path>`

## Recovery drill (recommended monthly)

1. Take fresh backup.
2. Restore into a non-production environment.
3. Validate login, student list, fee and marks queries.
4. Record drill date, operator, and result.
