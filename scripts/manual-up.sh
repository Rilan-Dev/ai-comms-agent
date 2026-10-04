#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env.docker ]]; then
  cp .env.docker.example .env.docker
  echo "Created .env.docker from the safe defaults template."
  echo "Edit .env.docker and replace CREDENTIALS_MASTER_KEY and SESSION_SIGNING_KEY before production use."
fi

docker compose -f infra/docker-compose.manual.yml up -d --build
echo "Self-hosted stack is starting."
echo "Web:      http://localhost:3000"
echo "RabbitMQ: http://localhost:15672"
echo "Qdrant:   http://localhost:6333"
echo "Postgres: postgresql://aca:***@localhost:5432/aca"
