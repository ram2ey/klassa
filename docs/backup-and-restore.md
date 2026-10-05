# Backup and restore runbook

Targets: backup every six hours; maximum 24-hour data loss (RPO); full recovery within eight hours (RTO). Retain 30 days locally and arrange encrypted off-site retention through the deployment operator. These are operational targets, not verified guarantees.

## Backups

Run `scripts/backup.sh` with `DATABASE_URL` for the migration owner and `BACKUP_DIR` pointing to protected storage. Use a PostgreSQL client matching the server major version. The script publishes completed compressed plain SQL dumps and companion SHA-256 checksums. It preserves GRANT/REVOKE statements; do not add `--no-privileges`.

Protect the archives as sensitive data: they include account credential hashes and school records. Store encryption/authentication secrets separately in the secret manager and test their recovery. A checksum detects corruption; it does not authenticate an archive from an untrusted source.

Configure and verify the actual backup schedule, retention and encrypted off-site upload in Coolify or your operations tooling. This repository does not provision that schedule or storage.

## Restore

1. Stop web and worker traffic. Select an isolated target for a drill, or explicitly confirm the recovery target before a real restore. Use a trusted archive and its matching checksum file.
2. Connect as the migration owner, with permission to create the restricted cluster roles on a new cluster. `pg_dump` does not include cluster roles. Use the original migration-owner role name, or recreate that source role as NOLOGIN with your cluster administrator before restoring under a different owner: preserved default-privilege statements can reference it. New app/worker roles are created NOLOGIN; existing passwords are preserved. Never restore as `klassa_app` or `klassa_sms_worker`.
3. Run:

   ```bash
   export DATABASE_URL='postgresql://<migration-owner>:<password>@postgres:5432/klassa'
   bash scripts/restore.sh /var/backups/klasso/klasso_YYYYMMDD_HHMMSSZ.sql.gz
   ```

   A checksum is required. The script fully decompresses before restoring, then restores and reconciles permissions in one transaction. The accompanying `database-security.sql` repairs legacy dumps without ACLs and rejects unsafe application role privileges or missing tenant policies. Any restore/permission failure rolls back the transaction.
4. Set the deployment secrets and run `npm run db:deploy` using owner credentials before restarting traffic. This sets restricted role passwords, checks RLS and SMS function privileges, and ensures a platform administrator exists. If one exists, bootstrap credentials are unnecessary; on a fresh installation, missing/invalid credentials fail deployment.
5. Verify `/api/health`, account login, exact expected snapshot counts, sensitive record decryption, and cross-school access denial. Keep the SMS worker stopped until recipients, provider credentials and queued records have been reviewed.

## Restore drill

Use a disposable database and provide snapshot counts recorded from the backup's source snapshot, plus a trusted backup creation time:

```bash
export STAGING_DATABASE_URL='postgresql://<migration-owner>:<password>@localhost:5432/klassa_drill'
export CONFIRM_DRILL_TARGET=yes
export BACKUP_CREATED_AT='2026-10-04T00:00:00Z'
export EXPECTED_STUDENTS=123
export EXPECTED_GUARDIANS=200
export EXPECTED_ENROLLMENTS=123
bash scripts/restore-drill.sh /path/to/verified.sql.gz
```

The drill requires explicit target selection, verifies the checksum, compares counts and enforces backup age/restore duration. The database is retained for application verification. GNU `date` is required (run in the Linux operations environment). Include provisioning and application verification time when assessing full RTO. Record real evidence in `docs/restore-drills-log.md`; database checks alone do not establish full recovery.
