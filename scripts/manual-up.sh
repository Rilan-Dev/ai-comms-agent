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

docker compose -f infra/docker-compose.manual.yml build --pull
# Apply the forward-only PostgreSQL migration chain before starting the web
# process. The application expects the current schema contract; rebuilding
# containers alone cannot reconcile an already-provisioned external database.
migration_db_url="$(docker compose --env-file .env.docker -f infra/docker-compose.manual.yml config --environment | awk -F= '$1 == "DATABASE_URL" {sub(/^[^=]*=/, ""); print; exit}')"
if [[ -z "$migration_db_url" ]]; then
  echo "ERROR: DATABASE_URL is required in .env.docker for the manual deployment migration." >&2
  exit 1
fi
DATABASE_URL="$migration_db_url" bash scripts/migrate.sh

docker compose --env-file .env.docker -f infra/docker-compose.manual.yml up -d

echo "Application stack is starting."
echo "Web: http://localhost:3300"
echo "Infrastructure: external (Postgres / Redis / RabbitMQ / Qdrant)"
