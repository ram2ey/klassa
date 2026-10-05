#!/usr/bin/env bash
# Klasso Automated Database Backup Procedure
# Target: PostgreSQL 17 multi-tenant schema with SHA-256 verification
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/klasso}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_FILE="${BACKUP_DIR}/klasso_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting Klasso database backup at ${TIMESTAMP}..."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set."
  exit 1
fi

# Publish only completed archives. Failed dumps must not appear restorable.
TEMP_FILE=$(mktemp "${BACKUP_DIR}/.klasso-backup.XXXXXX")
trap 'rm -f -- "$TEMP_FILE"' EXIT
# Preserve GRANT/REVOKE statements; no-owner permits a new migration owner.
pg_dump "${DATABASE_URL}" \
  --format=plain \
  --no-owner \
  --clean \
  --if-exists \
  | gzip -9 > "${TEMP_FILE}"
mv -- "${TEMP_FILE}" "${BACKUP_FILE}"

# Generate SHA-256 integrity hash
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"

echo "[SUCCESS] Backup created: ${BACKUP_FILE}"
echo "[SUCCESS] Integrity hash: $(cat "${CHECKSUM_FILE}")"

# Retention policy: remove backups older than retention days
find "${BACKUP_DIR}" -name "klasso_*.sql.gz*" -mtime "+${RETENTION_DAYS}" -delete
echo "[INFO] Retention cleanup completed (retention: ${RETENTION_DAYS} days)."

