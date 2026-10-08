#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MIGRATE_SCRIPT="${SCRIPT_DIR}/migrate.sh"

command -v psql >/dev/null || { echo "psql is required" >&2; exit 1; }
[[ -f "${MIGRATE_SCRIPT}" ]] || { echo "scripts/migrate.sh is required" >&2; exit 1; }

if [[ "${RESET_DATABASE_CONFIRM:-}" != "YES" ]]; then
  echo "ERROR: this permanently drops the application database schemas (aca and private)." >&2
  echo "Set RESET_DATABASE_CONFIRM=YES to continue." >&2
  echo "Example: RESET_DATABASE_CONFIRM=YES DATABASE_URL='...' bash scripts/reset-and-migrate.sh" >&2
  exit 2
fi

echo "Resetting application database schemas: aca, private"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS aca CASCADE;
DROP SCHEMA IF EXISTS private CASCADE;
CREATE SCHEMA aca;
CREATE SCHEMA private;
SQL

echo "Database reset complete. Running migrations..."
cd -- "${SCRIPT_DIR}/.."\nexec bash "./scripts/migrate.sh"
