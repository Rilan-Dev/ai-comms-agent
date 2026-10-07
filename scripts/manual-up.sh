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
docker compose -f infra/docker-compose.manual.yml up -d

echo "Application stack is starting."
echo "Web: http://localhost:3300"
echo "Infrastructure: external (Postgres / Redis / RabbitMQ / Qdrant)"
