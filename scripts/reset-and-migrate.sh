#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MIGRATE_SCRIPT="${SCRIPT_DIR}/migrate.sh"
MIGRATIONS_DIR="${SCRIPT_DIR}/../supabase/migrations"
LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/ai-comms-agent-reset.XXXXXX.log")"
KEEP_LOG=0
cleanup(){ [[ "${KEEP_LOG}" -eq 0 ]] && rm -f -- "${LOG_FILE}"; }
trap cleanup EXIT

command -v psql >/dev/null || { echo "ERROR: psql is required." >&2; exit 1; }
[[ -f "${MIGRATE_SCRIPT}" ]] || { echo "ERROR: scripts/migrate.sh is required." >&2; exit 1; }
[[ -d "${MIGRATIONS_DIR}" ]] || { echo "ERROR: supabase/migrations is required." >&2; exit 1; }
if [[ "${RESET_DATABASE_CONFIRM:-}" != "YES" ]]; then
  echo "ERROR: destructive reset requires RESET_DATABASE_CONFIRM=YES." >&2
  exit 2
fi

echo "RESET  aca, private"
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q >/dev/null 2>"$LOG_FILE" <<'SQL'
DROP SCHEMA IF EXISTS aca CASCADE;
DROP SCHEMA IF EXISTS private CASCADE;
CREATE SCHEMA aca;
CREATE SCHEMA private;
SQL
then
  KEEP_LOG=1
  echo "ERROR: database reset failed." >&2
  tail -12 "$LOG_FILE" >&2
  echo "Log: $LOG_FILE" >&2
  exit 1
fi
echo "OK     schemas reset"

# -----------------------------------------------------------------------------
# Convergence hardening — reset outage 2026-10-16 (companion: scripts/migrate.sh)
#
# The reset previously only dropped aca/private, so two classes of stale state
# in `public` survived EVERY reset and made re-runs fail deterministically:
#   1. public._aca_schema_migrations — the legacy ledger recorded migrations
#      as applied while their tables were dropped; migrate.sh then SKIPped
#      them forever ("un-retryable" state).
#   2. Stale public tables/types — unqualified CREATE TABLE/TYPE IF NOT EXISTS
#      resolves names through the session search_path, so a stale public
#      object with the same name silently suppressed creation of the aca
#      object (the 0002 "relation aca.agents does not exist" failure).
# Both are purged below. The object-name set is derived from the migration
# sources themselves (comment-stripped) — nothing is hand-maintained.
# -----------------------------------------------------------------------------
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "DROP TABLE IF EXISTS public._aca_schema_migrations" >/dev/null 2>>"$LOG_FILE"; then
  KEEP_LOG=1
  echo "ERROR: legacy public ledger purge failed." >&2
  tail -12 "$LOG_FILE" >&2
  echo "Log: $LOG_FILE" >&2
  exit 1
fi

purge_shadows() {
  local kind="$1" name
  while IFS= read -r name; do
    [[ -z "${name}" ]] && continue
    if ! psql "$DB_URL" -v ON_ERROR_STOP=0 -q -c "DROP ${kind} IF EXISTS public.\"${name}\" CASCADE" >/dev/null 2>>"$LOG_FILE"; then
      echo "WARN  could not drop public.${name} (continuing)" >&2
    fi
  done < <(cat "${MIGRATIONS_DIR}"/*.sql \
           | sed -E 's/--.*$//' \
           | grep -oE "CREATE ${kind} (IF NOT EXISTS )?[A-Za-z_][A-Za-z0-9_.]*" \
           | sed -E "s/^CREATE ${kind} (IF NOT EXISTS )?//; s/^(aca|private)\.//g" \
           | sort -u)
}
purge_shadows "TABLE"
purge_shadows "TYPE"
echo "OK     stale public shadow objects purged"
# -----------------------------------------------------------------------------

cd -- "${SCRIPT_DIR}/.."
if ! bash "$MIGRATE_SCRIPT" 2>&1 | tee -a "$LOG_FILE"; then
  KEEP_LOG=1
  echo "ERROR: migration failed." >&2
  echo "Log: $LOG_FILE" >&2
  exit 1
fi
APPLIED_COUNT="$(grep -c '^APPLY ' "$LOG_FILE" || true)"
SKIPPED_COUNT="$(grep -c '^SKIP ' "$LOG_FILE" || true)"
echo "OK     database ready (${APPLIED_COUNT} applied, ${SKIPPED_COUNT} skipped)"

# Post-apply verification: prove the chain actually produced the core
# application tables and recorded every file before reporting success.
MISSING=0
for t in organizations users organization_memberships agents conversations email_accounts audit_events; do
  STATE="$(psql "$DB_URL" -Atqc "SELECT CASE WHEN to_regclass('aca.${t}') IS NULL THEN 'missing' ELSE 'ok' END")"
  if [[ "${STATE}" != "ok" ]]; then
    echo "WARN   verification: aca.${t} missing after migration" >&2
    MISSING=1
  fi
done
LEDGER_COUNT="$(psql "$DB_URL" -Atqc "SELECT count(*) FROM aca._aca_schema_migrations")"
FILE_COUNT="$(ls -1 "${MIGRATIONS_DIR}"/*.sql | wc -l)"
if [[ "${MISSING}" -ne 0 ]] || [[ "${LEDGER_COUNT}" -lt "${FILE_COUNT}" ]]; then
  KEEP_LOG=1
  echo "ERROR: post-migration verification failed (ledger=${LEDGER_COUNT}, files=${FILE_COUNT})." >&2
  echo "Log: $LOG_FILE" >&2
  exit 1
fi
echo "OK     verification: ${LEDGER_COUNT}/${FILE_COUNT} migrations recorded, core tables present"
