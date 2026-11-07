# PostgreSQL Backup and Restore Runbook

## Purpose

This runbook defines PostgreSQL backup, restore, verification, and disaster
recovery procedures for the Autonomous AI Research Platform.

The current implementation supports local and CI-based backup/recovery testing.

Production backup scheduling, retention, encryption, and off-site storage will
depend on the final deployment platform.

## 1. Available Scripts

The repository provides:

- `scripts/backup-postgres.sh`
- `scripts/restore-postgres.sh`
- `scripts/verify-postgres-recovery.sh`

These scripts provide backup creation, isolated restoration, integrity
verification, and automated disaster-recovery testing.

## 2. Backup Storage

Local backups are written to:

`backups/`

Generated `.sql` files are ignored by Git.

Only `backups/.gitkeep` is tracked.

Database backups must never be committed to source control.

## 3. Create a Backup

From the repository root run:

`./scripts/backup-postgres.sh`

The default database is:

`research`

The default PostgreSQL user is:

`research`

A successful backup creates a file similar to:

`backups/research_YYYYMMDD_HHMMSS.sql`

The backup script verifies that the resulting file is not empty.

## 4. Explicit Database Selection

The research database can also be selected explicitly:

`POSTGRES_DB=research ./scripts/backup-postgres.sh`

Only use the name of a database that actually exists.

Available databases can be checked with:

`docker compose exec -T postgres psql -U research -d postgres -c "\l"`

## 5. Backup Failure Handling

If `pg_dump` fails, the backup script:

1. Reports the PostgreSQL error.
2. Reports that backup creation failed.
3. Deletes the incomplete backup file.
4. Exits with a non-zero status.

This prevents a failed or empty SQL file from being mistaken for a valid
backup.

This behavior has been tested using a nonexistent database.

## 6. Restore Safety

Recovery testing must not overwrite the primary `research` database.

The restore script intentionally refuses direct test restoration into:

`research`

A separate database should be used for restore testing.

Example:

`RESTORE_DB=research_restore_test ./scripts/restore-postgres.sh backups/research_BACKUP.sql`

Replace `research_BACKUP.sql` with the name of a real backup file.

## 7. Restore Process

The restore script performs the following checks:

1. Confirms the supplied backup file exists.
2. Refuses the primary `research` database as the restore target.
3. Drops the isolated restore database if it already exists.
4. Creates a clean restore database.
5. Loads the SQL backup.
6. Stops if PostgreSQL reports an error.

## 8. Automated Disaster-Recovery Verification

Run:

`./scripts/verify-postgres-recovery.sh`

The script automatically:

1. Creates an isolated source database.
2. Creates a test table.
3. Inserts known test data.
4. Creates a PostgreSQL backup.
5. Creates an isolated restore database.
6. Restores the backup.
7. Queries the restored data.
8. Compares the recovered data with the expected value.
9. Removes temporary databases.
10. Removes temporary backup data.

A successful test ends with:

`PostgreSQL backup and restore verification PASSED.`

It also reports:

`Recovered message: M5 disaster recovery verification`

## 9. Cleanup Verification

Temporary recovery databases should not remain after the automated test.

They can be checked using:

`docker compose exec -T postgres psql -U research -d postgres -c "SELECT datname FROM pg_database WHERE datname LIKE 'm5_backup_source_%' OR datname LIKE 'm5_backup_restore_%';"`

The expected result is:

`(0 rows)`

The verification script uses cleanup handling so temporary databases are
removed even when recovery testing fails.

## 10. CI Recovery Verification

GitHub Actions executes:

`./scripts/verify-postgres-recovery.sh`

This verifies that repository changes have not broken:

- Backup creation
- PostgreSQL restoration
- Data-integrity checking
- Temporary resource cleanup

A successful CI test does not replace production disaster-recovery exercises.

## 11. What Makes a Backup Valid

A backup should not be considered reliable only because a file exists.

Validation should confirm:

- `pg_dump` completed successfully.
- The backup file is non-empty.
- Failed dumps are removed.
- PostgreSQL accepts the restore.
- Expected schema objects are restored.
- Expected data is restored.
- Restore errors cause failure.
- Temporary recovery resources are cleaned up.

## 12. Production Backup Requirements

Before production deployment, define:

- Backup frequency
- Retention period
- Off-site storage
- Encryption requirements
- Access permissions
- Backup owner
- Recovery owner
- Recovery Point Objective (RPO)
- Recovery Time Objective (RTO)

These values depend on business requirements and the final hosting platform.

## 13. Off-Site Backups

Production backups should not exist only on the same machine or storage system
as the active PostgreSQL database.

Production should use protected remote storage such as:

- Cloud object storage
- Managed encrypted backup storage
- Another approved off-site backup service

The exact technology will depend on the production platform.

## 14. Database Migration Safety

Before destructive schema changes:

1. Confirm a recent valid backup exists.
2. Confirm recovery verification passes.
3. Review the migration.
4. Prefer backward-compatible schema changes.
5. Avoid irreversible data deletion where possible.
6. Define recovery behavior before deployment.

Application rollback does not automatically reverse database schema changes.

## 15. Incident Recovery

During a database incident:

1. Stop destructive operations.
2. Record the incident timestamp.
3. Identify the affected database.
4. Identify the appropriate valid backup.
5. Determine possible data-loss impact.
6. Restore into an isolated environment first where possible.
7. Validate schema and recovered data.
8. Perform production restoration only through an approved process.
9. Verify application connectivity after recovery.
10. Review logs, metrics, and traces.
11. Record the final recovery result.

## 16. Recovery Evidence

For important recovery exercises retain evidence of:

- Date and time
- Backup result
- Backup size
- Restore result
- Data-integrity result
- Cleanup result
- Relevant CI result
- Errors encountered
- Corrective actions

Database contents and SQL dumps must not be committed to Git.

## 17. Current Verified Capabilities

The repository has verified:

- PostgreSQL backup creation
- Backup failure detection
- Automatic deletion of incomplete backup files
- Restore into isolated databases
- Recovery of known test data
- Recovery cleanup
- CI disaster-recovery verification
- Protection against direct test restoration into `research`

## 18. Current Production Limitations

The current implementation does not yet provide:

- Scheduled production backups
- Automated retention management
- Off-site production storage
- Production backup encryption configuration
- Production recovery automation
- Final RPO commitment
- Final RTO commitment

These items remain dependent on the final deployment and operational platform.
