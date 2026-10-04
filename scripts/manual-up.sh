#!/usr/bin/env bash
set -euo pipefail
docker compose -f infra/docker-compose.manual.yml up -d --build
echo "Manual stack is starting."
echo "Web:      http://localhost:3000"
echo "RabbitMQ: http://localhost:15672"
echo "Qdrant:   http://localhost:6333"
echo "Database: localhost:5432"
