#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MIGRATE_SCRIPT="${SCRIPT_DIR}/migrate.sh"
LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/ai-comms-agent-reset.XXXXXX.log")"
KEEP_LOG=0
cleanup(){ [[ "${KEEP_LOG}" -eq 0 ]] && rm -f -- "${LOG_FILE}"; }
trap cleanup EXIT

command -v psql >/dev/null || { echo "ERROR: psql is required." >&2; exit 1; }
[[ -f "${MIGRATE_SCRIPT}" ]] || { echo "ERROR: scripts/migrate.sh is required." >&2; exit 1; }
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

# Purge stale "shadow" tables that may have been created in the `public`
# schema by the old buggy migrate.sh (which didn't set search_path = aca,public
# before running migration files). These shadow tables are duplicates of the
# real tables in `aca` and can cause confusion when Postgres resolves
# unqualified table references. The purge drops ALL user-created tables from
# `public` — the `public` schema should only contain Supabase-managed
# objects (auth, storage, etc.), never application tables.
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q >/dev/null 2>"$LOG_FILE" <<'SQL'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'schema_%'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT IN ('_aca_schema_migrations')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.table_name);
  END LOOP;
END $$;
SQL
then
  KEEP_LOG=1
  echo "ERROR: stale public shadow purge failed." >&2
  tail -12 "$LOG_FILE" >&2
  echo "Log: $LOG_FILE" >&2
  exit 1
fi
echo "OK     stale public shadow objects purged"

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
