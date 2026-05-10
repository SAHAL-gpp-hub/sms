# Runbook: PostgreSQL Backup and Restore

## Backup

```bash
cd <repository-root>
./ops/backup_db.sh
```

The script writes timestamped dumps into `<repository-root>/backups/runtime`.

## Restore

```bash
cd <repository-root>
./ops/restore_db.sh <repository-root>/backups/runtime/sms_backup_<timestamp>.sql
```

## Recovery drill (recommended monthly)

1. Take fresh backup.
2. Restore into a non-production environment.
3. Validate login, student list, fee and marks queries.
4. Record drill date, operator, and result.
