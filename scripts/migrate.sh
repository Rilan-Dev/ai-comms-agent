#!/usr/bin/env bash
set -euo pipefail
DB_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"
TMP_ERR="$(mktemp "${TMPDIR:-/tmp}/ai-comms-agent-migrate.XXXXXX.err")"
trap 'rm -f -- "${TMP_ERR}"' EXIT
command -v psql >/dev/null || { echo "ERROR: psql is required." >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "ERROR: sha256sum is required." >&2; exit 1; }

# -----------------------------------------------------------------------------
# Runner hardening — reset outage 2026-10-16 (companion: scripts/reset-and-migrate.sh)
#
#   * search_path is pinned for EVERY migration invocation. PR #29 pinned it
#     inside 0001_identity_rbac.sql only, but each migration file runs in its
#     own psql session, so the setting did not propagate: unqualified
#     CREATE TABLE / CREATE TYPE IF NOT EXISTS in later files still resolved
#     through the session default search_path. With the Supabase `postgres`
#     role (no "$user" schema named aca) that default is `public`, so DDL
#     landed in public while guards expected aca.* objects — the
#     "relation aca.agents does not exist" failure. public stays on the
#     path because extension objects (pgcrypto, citext) live there.
#   * The migration ledger lives INSIDE aca, so the destructive reset drops
#     it together with the schema. The legacy public._aca_schema_migrations
#     ledger survived every reset, which made a previously failed run
#     permanently mark migrations as applied while their tables were gone —
#     re-running the reset could never converge. A legacy public ledger is
#     adopted once (plain migrate runs on pre-fix databases), then ignored.
#   * Every file applies inside ONE transaction (--single-transaction): a
#     failing file rolls back completely and leaves no half-applied state.
#     (No migration uses CREATE INDEX CONCURRENTLY, which would forbid this.)
# -----------------------------------------------------------------------------
export PGOPTIONS='-c search_path=aca,public'

if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q >/dev/null 2>"$TMP_ERR" <<'SQL'
CREATE SCHEMA IF NOT EXISTS aca;
CREATE TABLE IF NOT EXISTS aca._aca_schema_migrations (
  version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF to_regclass('public._aca_schema_migrations') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM aca._aca_schema_migrations) THEN
    INSERT INTO aca._aca_schema_migrations (version, checksum, applied_at)
    SELECT version, checksum, applied_at FROM public._aca_schema_migrations;
    RAISE NOTICE 'migrate: adopted % legacy ledger entry/entries from public._aca_schema_migrations',
      (SELECT count(*) FROM public._aca_schema_migrations);
  END IF;
END $$;
SQL
then
  echo "ERROR: unable to initialize migration ledger." >&2
  if [[ -s "$TMP_ERR" ]]; then
    echo "ERROR: PostgreSQL connection/DDL diagnostic:" >&2
    tail -12 "$TMP_ERR" >&2
  else
    echo "ERROR: psql returned no diagnostic output." >&2
  fi
  exit 1
fi

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
for file in "${migrations[@]}"; do
  version="$(basename "$file")"
  checksum="$(sha256sum "$file" | awk '{print $1}')"
  applied="$(psql "$DB_URL" -Atqc "SELECT checksum FROM aca._aca_schema_migrations WHERE version = '$version'")"
  if [[ -n "$applied" ]]; then
    if [[ "$applied" != "$checksum" ]]; then
      echo "ERROR: migration checksum changed after application: $version" >&2
      exit 2
    fi
    echo "SKIP  $version"
    continue
  fi

  echo "APPLY $version"
  : >"$TMP_ERR"
  if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$file" >/dev/null 2>"$TMP_ERR"; then
    echo "ERROR: migration failed: $version" >&2
    echo "ERROR: the file ran inside a single transaction and rolled back cleanly; nothing is half-applied." >&2
    grep -E '(^|: )ERROR:|^DETAIL:|^HINT:|^CONTEXT:|^STATEMENT:' "$TMP_ERR" | tail -12 >&2 || tail -12 "$TMP_ERR" >&2
    exit 1
  fi
  if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "INSERT INTO aca._aca_schema_migrations(version, checksum) VALUES ('$version', '$checksum')" >/dev/null 2>"$TMP_ERR"; then
    echo "ERROR: failed to record migration: $version" >&2
    tail -12 "$TMP_ERR" >&2
    exit 1
  fi
done
echo "PASS: migration chain complete."
