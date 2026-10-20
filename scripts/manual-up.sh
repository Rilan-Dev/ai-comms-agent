#!/usr/bin/env bash
set -Eeuo pipefail

# Always run from the repository root, regardless of the caller's directory.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# Check required commands.
for cmd in docker node; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $cmd" >&2
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose v2 is required." >&2
  exit 1
fi

# Create .env from safe defaults if it does not exist.
if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.example "$ENV_FILE"
  chmod 600 "$ENV_FILE" || true
  echo "Created .env from .env.example."
  echo "Configure PostgreSQL, Redis, RabbitMQ, and Qdrant endpoints in .env."
  echo "Review the configuration, then run this script again."
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

echo "Building application images..."
"${COMPOSE[@]}" build --pull

# The selected .env is applied by Compose to all containers. Test the same
# target from inside the application network before running ANY migration.
# A profiled postgres service is NOT started by --no-deps; never silently
# substitute a disposable or default database for an unreachable target.
echo "Checking PostgreSQL connectivity from the application network..."
if ! "${COMPOSE[@]}" run --rm --no-deps web node packages/db/manual-db-preflight.mjs; then
  echo "ERROR: PostgreSQL is unreachable from the Compose application." >&2
  echo "HINT: Check .env DATABASE_URL. If PostgreSQL is external and published on the Docker host, use host.docker.internal with its published port." >&2
  echo "HINT: If you intentionally use the optional local-infra postgres service, start it separately and configure the actual account/database." >&2
  echo "Skipping migrations and startup; no fallback database will be selected." >&2
  exit 1
fi

# Run migrations in a one-off application container so Compose service DNS
# (for example, postgres:5432) resolves over the internal Docker network.
# The Dockerfile intentionally does not copy supabase/, so mount migrations
# read-only at the path auto-detected by packages/db/migrate.js.
echo "Applying database migrations inside Docker..."
if "${COMPOSE[@]}" run --rm --no-deps \
  --volume "$PROJECT_ROOT/supabase:/workspace/supabase:ro" \
  web node packages/db/migrate.js; then
  echo "Database migrations completed."
else
  migration_status=$?
  echo "ERROR: Migration runner exited with status $migration_status." >&2
  echo "Database migration failed; not starting services against a potentially incompatible schema." >&2
  echo "Resolve the migration error and rerun this command. No automatic target replacement or retry is performed." >&2
  exit "$migration_status"
fi

echo "Starting application stack..."
"${COMPOSE[@]}" up -d

echo
echo "Application stack startup requested."
echo "Web: http://localhost:3300"
echo "Infrastructure: externally managed PostgreSQL / Redis / RabbitMQ / Qdrant"
echo
echo "Container status:"
"${COMPOSE[@]}" ps
