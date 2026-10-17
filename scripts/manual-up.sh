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

migration_db_url=""

# Compose added "config --environment" after some packaged Docker Compose
# versions. Prefer it, but retain compatibility with older Compose v2 installs.
if compose_environment="$("${COMPOSE[@]}" config --environment 2>/dev/null)"; then
  migration_db_url="$(
    printf '%s\n' "$compose_environment" |
      awk -F= '$1 == "DATABASE_URL" {
        sub(/^[^=]*=/, "")
        print
        exit
      }'
  )"
else
  echo "NOTE: Compose lacks 'config --environment'; reading DATABASE_URL from the same host/.env interpolation sources."
  migration_db_url="${DATABASE_URL:-}"

  if [[ -z "$migration_db_url" ]]; then
    migration_db_url="$(
      awk '
        /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
        {
          line=$0
          sub(/^[[:space:]]*/, "", line)
          if (index(line, "DATABASE_URL=") == 1) {
            value=substr(line, length("DATABASE_URL=") + 1)
            sub(/[[:space:]]+#.*$/, "", value)
            dq=sprintf("%c",34)
            sq=sprintf("%c",39)
            if (substr(value,1,1)==dq || substr(value,1,1)==sq) value=substr(value,2)
            if (substr(value,length(value),1)==dq || substr(value,length(value),1)==sq) value=substr(value,1,length(value)-1)
            print value
            exit
          }
        }
      ' "$ENV_FILE"
    )"
  fi
fi

unset compose_environment

# An unresolved interpolation expression is not a usable host-side DSN.
if [[ "$migration_db_url" == *'${'* ]]; then
  echo "ERROR: DATABASE_URL contains unresolved Compose interpolation; update .env to a concrete URL or use a newer Docker Compose." >&2
  exit 1
fi

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
