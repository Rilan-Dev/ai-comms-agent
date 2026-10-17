#!/usr/bin/env bash
set -Eeuo pipefail

# Always run from the repository root, regardless of the caller's directory.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.manual.yml"
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

# Resolve DATABASE_URL from the same Compose environment used by the stack.
echo "Resolving migration database configuration..."

if ! compose_environment="$("${COMPOSE[@]}" config --environment)"; then
  echo "ERROR: Could not resolve the Compose environment." >&2
  exit 1
fi

migration_db_url="$(
  printf '%s\n' "$compose_environment" |
    awk -F= '$1 == "DATABASE_URL" {
      sub(/^[^=]*=/, "")
      print
      exit
    }'
)"

unset compose_environment

if [[ -z "$migration_db_url" ]]; then
  echo "ERROR: DATABASE_URL is missing from the Compose environment." >&2
  exit 1
fi

# The migration runner executes on the host, not inside Docker.
# Translate the Docker host alias for host-side database access.
migration_db_url="${migration_db_url//host.docker.internal/127.0.0.1}"

echo "Applying database migrations..."
if DATABASE_URL="$migration_db_url" node packages/db/migrate.js; then
  echo "Database migrations completed."
else
  migration_status=$?
  echo "WARNING: Migration runner exited with status $migration_status." >&2
  echo "Continuing with container startup, as requested."
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
