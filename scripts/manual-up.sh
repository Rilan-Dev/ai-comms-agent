#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env.docker ]]; then
  cp .env.docker.example .env.docker
  echo "Created .env.docker from the safe defaults template."
  echo "Edit .env.docker and configure your externally managed PostgreSQL, Redis, RabbitMQ, and Qdrant endpoints."
  exit 1
fi

# This compose file intentionally starts application containers only.
# PostgreSQL, Redis, RabbitMQ, and Qdrant are external services and are never
# created, managed, or networked as Compose services by this script.
docker compose -f infra/docker-compose.manual.yml build --pull && docker compose -f infra/docker-compose.manual.yml up -d

echo "Application stack is starting."
echo "Web: http://localhost:3000"
echo "Infrastructure: external (Postgres / Redis / RabbitMQ / Qdrant)"
