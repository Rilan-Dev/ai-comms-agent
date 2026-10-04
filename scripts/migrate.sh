#!/usr/bin/env bash
set -euo pipefail
DB_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"
command -v psql >/dev/null || { echo "psql is required" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum is required" >&2; exit 1; }
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS _aca_schema_migrations (
  version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);
SQL
shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
for file in "${migrations[@]}"; do
  version="$(basename "$file")"
  checksum="$(sha256sum "$file" | awk '{print $1}')"
  applied="$(psql "$DB_URL" -Atqc "SELECT checksum FROM _aca_schema_migrations WHERE version = '$version'")"
  if [[ -n "$applied" ]]; then [[ "$applied" == "$checksum" ]] || { echo "ERROR: migration changed after application: $version" >&2; exit 2; }; echo "SKIP $version"; continue; fi
  echo "APPLY $version"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO _aca_schema_migrations(version, checksum) VALUES ('$version', '$checksum')"
done
echo "Migration check: PASS"