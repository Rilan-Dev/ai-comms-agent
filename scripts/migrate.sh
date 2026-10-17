#!/usr/bin/env bash
set -euo pipefail
DB_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"
TMP_ERR="$(mktemp "${TMPDIR:-/tmp}/ai-comms-agent-migrate.XXXXXX.err")"
trap 'rm -f -- "${TMP_ERR}"' EXIT
command -v psql >/dev/null || { echo "ERROR: psql is required." >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "ERROR: sha256sum is required." >&2; exit 1; }

# CRITICAL: set search_path = aca,public for the migration ledger table
# creation and all subsequent queries. Without this, unqualified CREATE TABLE
# statements in migration files go to the `public` schema instead of `aca`,
# and later schema-qualified references (e.g. aca.organization_memberships)
# fail with "relation does not exist". The Node.js runner (packages/db/
# migrate.js) sets this correctly; the Bash runner must match.
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q >/dev/null 2>"$TMP_ERR" <<'SQL'
SET search_path = aca,public;
CREATE TABLE IF NOT EXISTS _aca_schema_migrations (
  version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);
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
  applied="$(psql "$DB_URL" -Atqc "SET search_path = aca,public; SELECT checksum FROM _aca_schema_migrations WHERE version = '$version'")"
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
  # Prepend SET search_path = aca,public; to each migration file so unqualified
  # CREATE TABLE / CREATE INDEX / CREATE FUNCTION statements go to the `aca`
  # schema. Without this, tables end up in `public` and later schema-qualified
  # references (aca.organization_memberships, etc.) fail with 42P01.
  if ! (echo "SET search_path = aca,public;"; cat "$file") | psql "$DB_URL" -v ON_ERROR_STOP=1 -q >/dev/null 2>"$TMP_ERR"; then
    echo "ERROR: migration failed: $version" >&2
    grep -E '(^|: )ERROR:|^DETAIL:|^HINT:|^CONTEXT:|^STATEMENT:' "$TMP_ERR" | tail -12 >&2 || tail -12 "$TMP_ERR" >&2
    exit 1
  fi
  if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "SET search_path = aca,public; INSERT INTO _aca_schema_migrations(version, checksum) VALUES ('$version', '$checksum')" >/dev/null 2>"$TMP_ERR"; then
    echo "ERROR: failed to record migration: $version" >&2
    tail -12 "$TMP_ERR" >&2
    exit 1
  fi
done
echo "PASS: migration chain complete."
