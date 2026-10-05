#!/usr/bin/env bash
set -euo pipefail

# Explicit opt-in local infrastructure verification.
# Nothing in the normal build/verify path starts these services.
COMPOSE_FILE="infra/docker-compose.verify.yml"
COMPOSE_PROJECT_NAME="aca-phase3-verify"
COMPOSE=(docker compose --project-name "$COMPOSE_PROJECT_NAME" --profile local-infra -f "$COMPOSE_FILE")
export DATABASE_URL="${DATABASE_URL:-postgresql://aca:aca_local_dev@127.0.0.1:55432/aca_verify}"

if ! "${COMPOSE[@]}" up -d --wait postgres; then
  echo "PostgreSQL bootstrap failed; container logs follow:" >&2
  "${COMPOSE[@]}" logs postgres >&2 || true
  "${COMPOSE[@]}" down -v || true
  exit 1
fi
trap '"${COMPOSE[@]}" down -v' EXIT

bash scripts/verify-migration-chain.sh

"${COMPOSE[@]}" run --rm migrate

"${COMPOSE[@]}" run --rm --entrypoint sh migrate -c   'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/scripts/verify-phase3-migration.sql'

set +e
"${COMPOSE[@]}" run --rm --entrypoint sh migrate -c   'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/scripts/verify-phase3-migration-fail.sql'   >/tmp/aca-ownerless.log 2>&1
status=$?
set -e

cat /tmp/aca-ownerless.log
if [[ "$status" -eq 0 ]] || ! grep -q "has no active owner at commit" /tmp/aca-ownerless.log; then
  echo "ERROR: ownerless organization was not rejected" >&2
  exit 1
fi

echo "Disposable PostgreSQL verification: PASS"
