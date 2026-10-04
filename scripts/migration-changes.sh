#!/usr/bin/env bash
set -euo pipefail
DB_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"
command -v psql >/dev/null || { echo "psql is required" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum is required" >&2; exit 1; }
failed=0
while IFS='|' read -r version applied; do
  [[ -n "$version" ]] || continue
  file="$MIGRATIONS_DIR/$version"
  [[ -f "$file" ]] || { echo "ERROR: applied migration missing: $version"; failed=1; continue; }
  current="$(sha256sum "$file" | awk '{print $1}')"
  if [[ "$current" != "$applied" ]]; then echo "ERROR: applied migration modified: $version"; failed=1; else echo "OK $version"; fi
done < <(psql "$DB_URL" -Atqc 'SELECT version, checksum FROM _aca_schema_migrations ORDER BY version')
((failed == 0)) || exit 2
echo "Migration changes: PASS"