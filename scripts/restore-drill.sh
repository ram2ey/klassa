#!/usr/bin/env bash
# Restore into an explicitly selected disposable database and record evidence.
set -euo pipefail
: "${STAGING_DATABASE_URL:?Set the isolated restore target explicitly}"
: "${CONFIRM_DRILL_TARGET:?Set CONFIRM_DRILL_TARGET=yes after verifying the disposable target}"
[ "${CONFIRM_DRILL_TARGET}" = yes ] || exit 1
: "${EXPECTED_STUDENTS:?Provide the source snapshot student count}"
: "${EXPECTED_GUARDIANS:?Provide the source snapshot guardian count}"
: "${EXPECTED_ENROLLMENTS:?Provide the source snapshot enrollment count}"
: "${BACKUP_CREATED_AT:?Provide the trusted backup snapshot UTC time (ISO 8601)}"
for count in "${EXPECTED_STUDENTS}" "${EXPECTED_GUARDIANS}" "${EXPECTED_ENROLLMENTS}"; do
  [[ "$count" =~ ^[0-9]+$ ]] || { echo '[ERROR] Expected counts must be nonnegative integers'; exit 1; }
done
BACKUP_DIR="${BACKUP_DIR:-/var/backups/klasso}"
LOG_FILE="${DRILL_LOG:-./klasso-restore-drill.log}"
LATEST_BACKUP="${1:-}"
if [ -z "$LATEST_BACKUP" ]; then
  shopt -s nullglob
  archives=("${BACKUP_DIR}"/klasso_*.sql.gz)
  [ "${#archives[@]}" -gt 0 ] || { echo '[ERROR] No backups found'; exit 1; }
  LATEST_BACKUP="${archives[${#archives[@]}-1]}"
fi
START_TIME=$(date +%s)
SNAPSHOT_TIME=$(date -u -d "$BACKUP_CREATED_AT" +%s)
BACKUP_AGE=$((START_TIME - SNAPSHOT_TIME))
[ "$BACKUP_AGE" -ge 0 ] && [ "$BACKUP_AGE" -le 86400 ] || { echo '[ERROR] Snapshot outside the 24-hour RPO'; exit 1; }
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
echo "[$(date -u +%FT%TZ)] DRILL START: $LATEST_BACKUP" | tee -a "$LOG_FILE"
DATABASE_URL="$STAGING_DATABASE_URL" CONFIRM_RESTORE=yes bash "$SCRIPT_DIR/restore.sh" "$LATEST_BACKUP" | tee -a "$LOG_FILE"
ACTUAL=$(psql "$STAGING_DATABASE_URL" --no-psqlrc -v ON_ERROR_STOP=1 -At -c \
  'SELECT (SELECT count(*) FROM students), (SELECT count(*) FROM guardians), (SELECT count(*) FROM enrollments)')
EXPECTED="${EXPECTED_STUDENTS}|${EXPECTED_GUARDIANS}|${EXPECTED_ENROLLMENTS}"
[ "$ACTUAL" = "$EXPECTED" ] || { echo "[ERROR] Count mismatch: expected $EXPECTED, restored $ACTUAL" | tee -a "$LOG_FILE"; exit 1; }
ELAPSED=$(($(date +%s) - START_TIME))
[ "$ELAPSED" -le 28800 ] || { echo '[ERROR] Restore exceeded 8 hours' | tee -a "$LOG_FILE"; exit 1; }
echo "[$(date -u +%FT%TZ)] Database checks passed: counts=$ACTUAL snapshot_age_seconds=$BACKUP_AGE restore_seconds=$ELAPSED" | tee -a "$LOG_FILE"
echo 'Target retained for login, decryption and tenant isolation checks. Full recovery acceptance remains pending until these pass.' | tee -a "$LOG_FILE"
