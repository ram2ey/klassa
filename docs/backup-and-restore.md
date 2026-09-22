# Klassa Backup and Restore Runbook

This document details the disaster recovery, backup automation, and restore procedures for Klassa in standalone Docker and Coolify environments.

---

## 1. Objectives and Service Levels

- **Recovery Point Objective (RPO):** 24 hours (maximum data loss window; backups run every 6 hours in production).
- **Recovery Time Objective (RTO):** 8 hours (maximum time to provision a clean instance and restore data).
- **Integrity Guarantee:** Every backup generates a companion SHA-256 hash verified prior to restoration.
- **Retention Period:** 30 days locally, 90 days in encrypted off-site S3 cold storage.

---

## 2. Automated Backups

### Coolify Scheduled Backups
1. Navigate to the **PostgreSQL** resource in the Coolify project.
2. Select **Backups** tab.
3. Configure:
   - **Frequency:** Every 6 hours (`0 */6 * * *`)
   - **Retention:** 30 days
   - **Storage Destination:** Private S3 bucket with server-side AES-256 encryption.
4. Verify the test backup runs cleanly.

### Standalone Docker & CLI
The backup script [`scripts/backup.sh`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/scripts/backup.sh) runs unattended via cron:

```bash
# Example cron configuration (/etc/cron.d/klasso-backup)
0 */6 * * * klasso /app/scripts/backup.sh >> /var/log/klasso-backup.log 2>&1
```

---

## 3. Step-by-Step Disaster Recovery Procedure

### Step 1: Isolate and Prepare Environment
Ensure the target PostgreSQL service is running and healthy:
```bash
docker compose ps postgres
```

### Step 2: Retrieve and Verify Backup File
Identify the latest verified backup and checksum:
```bash
ls -lt /var/backups/klasso/*.sql.gz | head -n 1
sha256sum -c /var/backups/klasso/klasso_YYYYMMDD_HHMMSSZ.sql.gz.sha256
```

### Step 3: Run the Restore Script
Execute the safe restore script:
```bash
export DATABASE_URL="postgresql://klasso:<password>@postgres:5432/klasso"
./scripts/restore.sh /var/backups/klasso/klasso_YYYYMMDD_HHMMSSZ.sql.gz
```

### Step 4: Run Application Health Check
Verify the service is up and database queries succeed:
```bash
curl -f http://127.0.0.1:3000/api/health
```

---

## 4. Monthly Restore Drills

To meet Phase 6 certification and institutional compliance:
1. Spin up an isolated staging database container.
2. Execute `./scripts/restore.sh` with the previous night's backup.
3. Verify row counts in `students`, `guardians`, and `enrollments`.
4. Log the drill result in the operational compliance register with timestamp and elapsed recovery time.
