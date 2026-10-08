#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MIGRATE_SCRIPT="${SCRIPT_DIR}/migrate.sh"
LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/ai-comms-agent-reset.XXXXXX.log")"
KEEP_LOG=0

cleanup() {
  if [[ "${KEEP_LOG}" -eq 0 ]]; then
    rm -f -- "${LOG_FILE}"
  fi
}
trap cleanup EXIT

command -v psql >/dev/null || { echo "ERROR: psql is required." >&2; exit 1; }
[[ -f "${MIGRATE_SCRIPT}" ]] || { echo "ERROR: scripts/migrate.sh is required." >&2; exit 1; }

if [[ "${RESET_DATABASE_CONFIRM:-}" != "YES" ]]; then
  echo "ERROR: this permanently drops the application database schemas (aca and private)." >&2
  echo "Set RESET_DATABASE_CONFIRM=YES to continue." >&2
  echo "Example: RESET_DATABASE_CONFIRM=YES DATABASE_URL='...' bash scripts/reset-and-migrate.sh" >&2
  exit 2
fi

echo "Resetting application database..."
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 >"$LOG_FILE" 2>&1 <<'SQL'
DROP SCHEMA IF EXISTS aca CASCADE;
DROP SCHEMA IF EXISTS private CASCADE;
CREATE SCHEMA aca;
CREATE SCHEMA private;
SQL
then
  KEEP_LOG=1
  echo "ERROR: database reset failed." >&2
  sed -n '/ERROR:/,/^$/p' "$LOG_FILE" | tail -20 >&2
  echo "Full reset log: $LOG_FILE" >&2
  exit 1
fi
echo "OK: application schemas reset."

echo "Applying migrations..."
cd -- "${SCRIPT_DIR}/.."
if ! bash "$MIGRATE_SCRIPT" >>"$LOG_FILE" 2>&1; then
  KEEP_LOG=1
  echo "ERROR: migration failed." >&2
  awk '
    /ERROR:/ { show=1; count=0 }
    show { print; count++ }
    show && count >= 8 { show=0 }
  ' "$LOG_FILE" | tail -40 >&2
  echo "Full migration log: $LOG_FILE" >&2
  exit 1
fi

APPLIED_COUNT="$(grep -c '^APPLY ' "$LOG_FILE" || true)"
SKIPPED_COUNT="$(grep -c '^SKIP ' "$LOG_FILE" || true)"
echo "OK: migrations applied (${APPLIED_COUNT} applied, ${SKIPPED_COUNT} skipped)."
echo "Database reset and migration complete."
