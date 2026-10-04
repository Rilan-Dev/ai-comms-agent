#!/usr/bin/env bash
set -euo pipefail
COMPOSE_FILE="infra/docker-compose.verify.yml"
DB_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"
docker compose -f "$COMPOSE_FILE" up -d --wait postgres
trap 'docker compose -f "$COMPOSE_FILE" down -v' EXIT
export DATABASE_URL="$DB_URL"
docker compose -f "$COMPOSE_FILE" run --rm migrate

docker compose -f "$COMPOSE_FILE" exec -T postgres psql -v ON_ERROR_STOP=1 -f /workspace/scripts/verify-phase3-migration.sql
set +e
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -v ON_ERROR_STOP=1 -f /workspace/scripts/verify-phase3-migration-fail.sql >/tmp/aca-ownerless.log 2>&1
status=$?
set -e
cat /tmp/aca-ownerless.log
if [[ "$status" -eq 0 ]] || ! grep -q "has no active owner at commit" /tmp/aca-ownerless.log; then
  echo "ERROR: ownerless organization was not rejected" >&2
  exit 1
fi
echo "Docker Phase 3 verification: PASS"
