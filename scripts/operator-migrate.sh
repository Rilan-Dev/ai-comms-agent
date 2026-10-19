#!/usr/bin/env bash
# Safe, manual-only migration wrapper. NEVER resets databases or starts the app.
# Usage:
#   bash scripts/operator-migrate.sh plan [--expect-db aca]
#   bash scripts/operator-migrate.sh apply --expect-db aca --backup-confirmed
#   bash scripts/operator-migrate.sh verify --expect-db aca
# New EMPTY database only: add --allow-fresh to apply, after a separate review.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

usage() {
  cat <<'USAGE'
Usage: bash scripts/operator-migrate.sh plan|apply|verify [options]

Options:
  --expect-db DATABASE   Require PostgreSQL current_database() to match.
                         REQUIRED for apply and verify.
  --backup-confirmed      Operator confirms a usable external backup exists.
                         REQUIRED for apply. This script DOES NOT create one.
  --allow-fresh           Only for apply on a reviewed, genuinely NEW database.
                         An existing production database must have its ledger.
Environment:
  ACA_COMPOSE_FILE        Compose file (default: ./docker-compose.yml)
  The Compose env file is always ./.env to prevent split target configs.
  ACA_MIGRATION_SERVICE   Compose application service (default: web)
Workflow: build the exact checkout's app image, plan, back up the target
database independently, apply, verify, then deploy separately.
This script neither copies ElevenLabs API keys nor starts services.
USAGE
}
[[ $# -ge 1 ]] || { usage; exit 2; }
MODE="$1"; shift
case "$MODE" in plan|apply|verify) ;; *) usage >&2; exit 2;; esac

EXPECTED_DB=""
ALLOW_FRESH=0
BACKUP_CONFIRMED=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --expect-db)
      [[ $# -ge 2 && -n "$2" && -z "$EXPECTED_DB" ]] || { echo "ERROR: --expect-db requires one value." >&2; exit 2; }
      EXPECTED_DB="$2"; shift 2 ;;
    --backup-confirmed) BACKUP_CONFIRMED=1; shift ;;
    --allow-fresh) ALLOW_FRESH=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done
if [[ "$MODE" != "apply" && ( "$ALLOW_FRESH" -eq 1 || "$BACKUP_CONFIRMED" -eq 1 ) ]]; then
  echo "ERROR: --allow-fresh and --backup-confirmed are apply-only options." >&2
  exit 2
fi
if [[ "$MODE" != "plan" && -z "$EXPECTED_DB" ]]; then
  echo "ERROR: --expect-db DATABASE is required for apply and verify." >&2
  exit 2
fi
if [[ "$MODE" == "apply" && "$BACKUP_CONFIRMED" -ne 1 ]]; then
  echo "ERROR: apply requires --backup-confirmed after an independent, verified backup." >&2
  exit 2
fi
if [[ -n "$EXPECTED_DB" && ! "$EXPECTED_DB" =~ ^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$ ]]; then
  echo "ERROR: expected database name is invalid." >&2
  exit 2
fi
command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker is required." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: Docker Compose v2 is required." >&2; exit 1; }

COMPOSE_FILE="${ACA_COMPOSE_FILE:-$ROOT/docker-compose.yml}"
ENV_FILE="$ROOT/.env"
[[ "$COMPOSE_FILE" = /* ]] || COMPOSE_FILE="$ROOT/$COMPOSE_FILE"
[[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]] || {
  echo "ERROR: Compose file or .env missing. Never fall back to development DB credentials." >&2
  exit 1
}
[[ -d "$ROOT/supabase/migrations" ]] || { echo "ERROR: migrations directory is missing." >&2; exit 1; }
SERVICE="${ACA_MIGRATION_SERVICE:-web}"
[[ "$SERVICE" =~ ^[a-zA-Z][a-zA-Z0-9_-]*$ ]] || { echo "ERROR: invalid Compose service name." >&2; exit 2; }

# A static source check is separate from the live ledger/target check.
bash "$ROOT/scripts/verify-migration-chain.sh"

COMPOSE=(docker compose --project-directory "$ROOT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
# The Compose network resolves service-only PostgreSQL names. The application
# image must have been built at the current checkout revision before proceeding.
RUN=("${COMPOSE[@]}" run --rm --no-deps
  --volume "$ROOT/supabase:/workspace/supabase:ro"
  "$SERVICE")
CHECK_ARGS=()
[[ -z "$EXPECTED_DB" ]] || CHECK_ARGS+=(--expect-db "$EXPECTED_DB")

if [[ "$MODE" == "plan" ]]; then
  echo "READ-ONLY: inspecting the selected Compose database; no migration will run."
  "${RUN[@]}" node packages/db/operator-migration-check.mjs plan "${CHECK_ARGS[@]}"
  exit 0
fi

if [[ "$MODE" == "verify" ]]; then
  echo "READ-ONLY: verifying the migration ledger against this checkout."
  "${RUN[@]}" node packages/db/operator-migration-check.mjs verify "${CHECK_ARGS[@]}"
  exit 0
fi

PREFLIGHT_ARGS=("${CHECK_ARGS[@]}")
[[ "$ALLOW_FRESH" -eq 0 ]] || PREFLIGHT_ARGS+=(--allow-fresh)
echo "WRITE OPERATION: applying migrations to database '$EXPECTED_DB'."
echo "An independent backup has been confirmed; the script itself creates NO backup."
"${RUN[@]}" node packages/db/operator-migration-check.mjs preflight "${PREFLIGHT_ARGS[@]}"

LOG="$(mktemp "${TMPDIR:-/tmp}/aca-operator-migrate.XXXXXX")"
trap 'rm -f -- "$LOG"' EXIT
# Fail closed on errors: unlike scripts/manual-up.sh this does NOT launch an
# application with a partially migrated database.
if ! "${RUN[@]}" node packages/db/migrate.js 2>&1 | tee "$LOG"; then
  echo "ERROR: migration runner failed. Do not deploy until reconciled." >&2
  exit 1
fi
if ! grep -q '^PASS: migration chain complete\.' "$LOG"; then
  echo "ERROR: migration runner did not confirm completion." >&2
  exit 1
fi
if grep -Eq '(privilege_warnings|already_exists_skips)=[1-9][0-9]*' "$LOG"; then
  echo "ERROR: migration runner skipped database statements; inspect and resolve before deploying." >&2
  exit 1
fi
"${RUN[@]}" node packages/db/operator-migration-check.mjs verify "${CHECK_ARGS[@]}"
echo "PASS: migrations applied and verified. Deployment must be performed separately."
