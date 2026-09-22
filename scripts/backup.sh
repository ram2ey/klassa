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

# Run pg_dump with compression
pg_dump "${DATABASE_URL}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip -9 > "${BACKUP_FILE}"

# Generate SHA-256 integrity hash
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"

echo "[SUCCESS] Backup created: ${BACKUP_FILE}"
echo "[SUCCESS] Integrity hash: $(cat "${CHECKSUM_FILE}")"

# Retention policy: remove backups older than retention days
find "${BACKUP_DIR}" -name "klasso_*.sql.gz*" -mtime "+${RETENTION_DAYS}" -delete
echo "[INFO] Retention cleanup completed (retention: ${RETENTION_DAYS} days)."

