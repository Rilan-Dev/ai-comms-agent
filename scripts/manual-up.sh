#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env.docker ]]; then
  cp .env.docker.example .env.docker
  echo "Created .env.docker from the safe defaults template."
  echo "Edit .env.docker and configure your externally managed PostgreSQL, Redis, RabbitMQ, and Qdrant endpoints."
  exit 1
fi

# vendor/clara is the ai-reusable-libraries reference source. It is not part
# of the ai-comms-agent application build and must not be initialized as a
# Docker build prerequisite.

# Build Docker images (use --no-cache if source changes aren't picked up)
docker compose -f infra/docker-compose.manual.yml build --pull

# Apply migrations using the Node.js runner (not psql, which fails with
# SSL errors on Prisma Postgres Data Proxy). The Node.js runner is at
# packages/db/migrate.js and uses the pg library which handles SSL
# correctly via the connection string's sslmode=require parameter.
migration_db_url="$(docker compose --env-file .env.docker -f infra/docker-compose.manual.yml config --environment | awk -F= '$1 == "DATABASE_URL" {sub(/^[^=]*=/, ""); print; exit}')"
if [[ -z "$migration_db_url" ]]; then
  echo "ERROR: DATABASE_URL is required in .env.docker for the manual deployment migration." >&2
  exit 1
fi
migration_db_url="${migration_db_url//host.docker.internal/127.0.0.1}"
echo "Applying migrations via Node.js runner..."
DATABASE_URL="$migration_db_url" node packages/db/migrate.js || {
  echo "WARNING: Migration runner failed (migrations may already be applied)."
  echo "Continuing with container startup..."
}

docker compose --env-file .env.docker -f infra/docker-compose.manual.yml up -d

echo "Application stack is starting."
echo "Web: http://localhost:3300"
echo "Infrastructure: external (Postgres / Redis / RabbitMQ / Qdrant)"
