#!/usr/bin/env bash
# Klasso Database Restore Procedure
# Safely verifies checksum and restores a PostgreSQL backup
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <path_to_backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

if [ -f "${CHECKSUM_FILE}" ]; then
  echo "[INFO] Verifying SHA-256 checksum..."
  sha256sum -c "${CHECKSUM_FILE}"
  echo "[INFO] Checksum verified successfully."
else
  echo "[WARN] No checksum file found for ${BACKUP_FILE}. Proceeding with caution."
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set."
  exit 1
fi

echo "[CRITICAL] You are about to restore the database from: ${BACKUP_FILE}"
echo "[CRITICAL] This operation will overwrite current database contents."

if [ "${CONFIRM_RESTORE:-no}" != "yes" ]; then
  read -r -p "Type 'RESTORE' to confirm: " CONFIRMATION
  if [ "${CONFIRMATION}" != "RESTORE" ]; then
    echo "[ABORTED] Restore cancelled by user."
    exit 0
  fi
fi

echo "[INFO] Executing database restore..."
gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}" --no-psqlrc --set=ON_ERROR_STOP=on --single-transaction

echo "[SUCCESS] Klasso database restored successfully from ${BACKUP_FILE}."
