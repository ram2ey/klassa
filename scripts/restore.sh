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
  # Verify the selected archive, even when moved from its original backup path.
  EXPECTED_HASH=$(awk 'NR == 1 { print $1 }' "${CHECKSUM_FILE}")
  ACTUAL_HASH=$(sha256sum "${BACKUP_FILE}")
  ACTUAL_HASH="${ACTUAL_HASH%% *}"
  if [[ ! "$EXPECTED_HASH" =~ ^[0-9a-f]{64}$ ]] || [ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]; then
    echo "[ERROR] Backup checksum mismatch. Restore aborted."
    exit 1
  fi
  echo "[INFO] Checksum verified successfully."
else
  echo "[ERROR] A companion checksum is required: ${CHECKSUM_FILE}"
  exit 1
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
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# Fully decompress before opening the transaction, so a corrupt gzip stream
# cannot commit a partial restore when psql reaches EOF.
RESTORE_SQL=$(mktemp)
trap 'rm -f -- "$RESTORE_SQL"' EXIT
# Cluster roles are absent from pg_dump. New roles stay NOLOGIN until db:deploy.
{
  cat <<'SQL'
DO $$ BEGIN
  IF current_user IN ('klassa_app', 'klassa_sms_worker') THEN
    RAISE EXCEPTION 'Restore requires the migration owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'klassa_app') THEN
    CREATE ROLE klassa_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'klassa_sms_worker') THEN
    CREATE ROLE klassa_sms_worker NOLOGIN;
  END IF;
END $$;
SQL
  gunzip -c "${BACKUP_FILE}"
  cat "${SCRIPT_DIR}/database-security.sql"
} > "$RESTORE_SQL"
psql "${DATABASE_URL}" --no-psqlrc --set=ON_ERROR_STOP=on --single-transaction --file="$RESTORE_SQL"

echo "[SUCCESS] Database restored and role permissions verified. Run db:deploy and staging acceptance checks before reopening traffic."
