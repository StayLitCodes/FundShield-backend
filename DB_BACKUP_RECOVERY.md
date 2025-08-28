# Backup & Recovery Procedures

This document outlines recommended backup, recovery, and pooling strategies for the Postgres database used by FundShield.

1) Backup Strategy
- Full nightly backups using `pg_dump` or managed DB provider snapshots.
- Daily WAL archiving for point-in-time recovery (PITR).
- Retention: keep daily backups for 14 days, weekly backups for 12 weeks, monthly backups for 12 months.

Example (on the DB host):

pg_dump -Fc -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME > /backups/fundshield-$(date +%F).dump

2) Restore (simple)
- To restore a full dump:

pg_restore -d $DB_NAME -U $DB_USER -h $DB_HOST -p $DB_PORT /backups/fundshield-YYYY-MM-DD.dump

3) Point-in-time recovery (managed or WAL restore)
- Configure `archive_mode = on` and an archive command to store WALs.
- Follow Postgres PITR docs to restore to a given timestamp.

4) Connection Pooling
- Use connection pooling (PgBouncer) in transaction-pooling mode for higher concurrency.
- In application (TypeORM) set `extra: { max: 20, min: 2 }` or use environment variable DB_POOL_MAX.

5) Backups for cloud providers
- For AWS RDS/Aurora use automated snapshots and point-in-time recovery.

6) Testing and DR drills
- Perform quarterly restore drills to a separate environment and validate application behavior.

Notes
- Encrypt backups at rest and in transit.
- Rotate credentials and restrict access to backup storage.
