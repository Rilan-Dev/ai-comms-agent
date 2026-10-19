#!/usr/bin/env bash
# Interactive, fail-closed one-invocation operator release.
# Run FROM repository root: git pull --ff-only origin main && bash scripts/operator-one-shot.sh
# Never silently deploy the bundled development Compose or assume a backup exists.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
die() { echo "ERROR: $*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }
ask() { local label="$1"; local answer; read -r -p "$label" answer; printf '%s' "$answer"; }

[[ -t 0 ]] || die "An interactive terminal is required to verify production target and backup."
for bin in git bash node docker; do
  command -v "$bin" >/dev/null 2>&1 || die "Missing required command: $bin"
done
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."
[[ "$(git branch --show-current)" == "main" ]] || die "Switch to the existing main branch manually first."
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || die "Working tree is not clean. Preserve your local changes before releasing."
[[ -f .env ]] || die "Missing .env for the selected Compose migration environment; never auto-generate credentials."
[[ -d supabase/migrations ]] || die "Missing SQL migration files."

step "Choose the application release target"
echo "  1) vercel       (Vercel CLI; build limits and authorization still apply)"
echo "  2) docker       (requires a SEPARATE approved production Compose file)"
echo "  3) migration    (apply and verify database only; deploy app separately)"
target="${ACA_RELEASE_TARGET:-$(ask 'Target [1=vercel/2=docker/3=migration]: ')}"
# Accept the displayed menu numbers as well as explicit names. Keep the
# normalized, named target for every subsequent production-safety check.
case "$target" in
  1|vercel) target=vercel ;;
  2|docker) target=docker ;;
  3|migration) target=migration ;;
  *) die "Choose 1 (vercel), 2 (docker), or 3 (migration)." ;;
esac

MIGRATION_FILE="${ACA_COMPOSE_FILE:-docker-compose.yml}"
[[ "$MIGRATION_FILE" = /* ]] || MIGRATION_FILE="$ROOT/$MIGRATION_FILE"
[[ -f "$MIGRATION_FILE" ]] || die "Migration Compose file not found."
MIGRATION_COMPOSE=(docker compose --project-directory "$ROOT" --env-file "$ROOT/.env" -f "$MIGRATION_FILE")
MIGRATION_SERVICES="$("${MIGRATION_COMPOSE[@]}" config --services)"
grep -Fxq 'web' <<<"$MIGRATION_SERVICES" || die "Selected migration Compose must have web service."

if [[ "$target" == vercel ]]; then
  command -v vercel >/dev/null 2>&1 || die "Install/authenticate Vercel CLI on this host first."
  [[ -f .vercel/project.json ]] || die "Link the correct Vercel project first (vercel link); no automatic project selection."
  vercel whoami >/dev/null || die "Vercel CLI is not authenticated."
fi
if [[ "$target" == docker ]]; then
  PRODUCTION_FILE="${ACA_PRODUCTION_COMPOSE_FILE:-$(ask 'Approved production Compose file (NOT docker-compose.yml): ')}"
  [[ "$PRODUCTION_FILE" = /* ]] || PRODUCTION_FILE="$ROOT/$PRODUCTION_FILE"
  [[ -f "$PRODUCTION_FILE" ]] || die "Approved production Compose file missing."
  [[ "$PRODUCTION_FILE" != "$ROOT/docker-compose.yml" ]] || die "Bundled docker-compose.yml enables development identity; forbidden for production deployment."
  PRODUCTION_COMPOSE=(docker compose --project-directory "$ROOT" --env-file "$ROOT/.env" -f "$PRODUCTION_FILE")
  # Inspect resolved Compose in memory without printing environment secrets.
  "${PRODUCTION_COMPOSE[@]}" config --format json | node -e '
    let text = "";
    process.stdin.on("data", part => text += part);
    process.stdin.on("end", () => {
      const services = JSON.parse(text).services ?? {};
      if (!services.web) { console.error("Production Compose has no web service."); process.exitCode = 1; return; }
      for (const service of Object.values(services)) {
        const env = service.environment ?? {};
        if (String(env.ACA_ENABLE_DEV_IDENTITY).toLowerCase() === "true") {
          console.error("Development identity must never run on the production Compose.");
          process.exitCode = 1;
        }
      }
    });
  ' || die "Rejected production Compose environment."
fi

step "Pull current main (fast-forward only) and validate the source chain"
git pull --ff-only origin main
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || die "Git checkout changed unexpectedly after pull."
node --test scripts/tests/operator-migration-core.test.mjs scripts/tests/operator-migrate-script.test.mjs scripts/tests/operator-one-shot-script.test.mjs
bash scripts/verify-migration-chain.sh

step "Build the production web image from this exact source and execute package checks"
"${MIGRATION_COMPOSE[@]}" build web
# NEVER run automated test suites inside the production Compose service:
# env_file: .env can contain live DB, messaging and model credentials.
# Instead use the just-built immutable web image in an OFFLINE isolated Docker
# container with NO production environment and NO network access. Integration
# tests needing an external test database must run separately on a disposable
# target under OPS-01; never point them at the live migration database.
# Compose's "images -q" only lists CREATED service containers on some Docker
# versions. Build/tag an explicit same-source immutable verification image rather
# than requiring a currently running production service or guessing its tag.
WEB_IMAGE="aca-operator-verify:$(git rev-parse --short HEAD)"
docker build --target web --tag "$WEB_IMAGE" "$ROOT"
docker run --rm --network none \
  --volume "$ROOT/scripts:/workspace/scripts:ro" \
  --volume "$ROOT/docs:/workspace/docs:ro" \
  --volume "$ROOT/supabase:/workspace/supabase:ro" \
  --volume "$ROOT/infra:/workspace/infra:ro" \
  --volume "$ROOT/.github:/workspace/.github:ro" \
  --volume "$ROOT/README.md:/workspace/README.md:ro" \
  --volume "$ROOT/.env.example:/workspace/.env.example:ro" \
  "$WEB_IMAGE" sh -euc 'pnpm -r typecheck; pnpm -r test; pnpm --filter @ai-comms-agent/worker build'

if [[ "$target" == docker ]]; then
  step "Build the separately approved production Compose images before database writes"
  services=(web)
  PRODUCTION_SERVICES="$("${PRODUCTION_COMPOSE[@]}" config --services)"
  if grep -Fxq 'worker' <<<"$PRODUCTION_SERVICES"; then services+=(worker); fi
  "${PRODUCTION_COMPOSE[@]}" build "${services[@]}"
fi

step "Identify target PostgreSQL DATABASE and review pending migrations (READ ONLY)"
database="${ACA_EXPECT_DB:-$(ask 'Exact PostgreSQL database name (not schema; no default): ')}"
[[ "$database" =~ ^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$ ]] || die "Invalid or missing expected database name."
export ACA_COMPOSE_FILE="$MIGRATION_FILE"
bash scripts/operator-migrate.sh plan --expect-db "$database"

step "Backup and apply gate — review pending migration names printed above"
echo "STOP if the plan is unexpected, any statement is unsafe, or the independent"
echo "backup/snapshot is not complete and RESTORE-TESTED. This script does NOT back up the DB."
backup_ref="${ACA_BACKUP_REFERENCE:-$(ask 'Restorable backup filename or snapshot reference (required): ')}"
[[ -n "$backup_ref" && "$backup_ref" != "none" ]] || die "A real backup/snapshot reference is required."
confirm="$(ask "Type APPLY $database to confirm reviewed SQL + backup $backup_ref: ")"
[[ "$confirm" == "APPLY $database" ]] || die "Confirmation not matched. No database changes or deployment performed."

step "Apply and verify forward-only migrations against the confirmed database"
bash scripts/operator-migrate.sh apply --expect-db "$database" --backup-confirmed
bash scripts/operator-migrate.sh verify --expect-db "$database"

case "$target" in
  migration)
    echo "Migration complete; selected migration-only target. Deploy separately."
    ;;
  docker)
    step "Start only approved production services; do not provision/replace databases"
    "${PRODUCTION_COMPOSE[@]}" up -d --no-deps --no-build "${services[@]}"
    "${PRODUCTION_COMPOSE[@]}" ps
    ;;
  vercel)
    step "Request production Vercel deployment (rate-limit and permissions may fail)"
    vercel deploy --prod --yes
    ;;
esac

if [[ "$target" != migration && -n "${ACA_HEALTH_URL:-}" ]]; then
  [[ "$ACA_HEALTH_URL" =~ ^https?:// ]] || die "ACA_HEALTH_URL must be an HTTP(S) URL."
  command -v curl >/dev/null 2>&1 || die "curl is required for the configured health check."
  step "Check public app health (not proof of provider or tenant E2E readiness)"
  curl --fail --silent --show-error --location --max-time 20 "$ACA_HEALTH_URL" >/dev/null
fi

echo
echo "OPERATOR_WORKFLOW: PASS (target=$target, database=$database, main=$(git rev-parse --short HEAD))"
echo "This only verifies source/tests/migration ledger and requested deployment command."
echo "Live email/WhatsApp permissions, model-provider audio and browser E2E require separate acceptance."
