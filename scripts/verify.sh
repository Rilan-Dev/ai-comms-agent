#!/usr/bin/env bash
set -euo pipefail

# Deterministic source verification only.
# This script MUST NOT provision PostgreSQL, Redis, RabbitMQ, Qdrant, or any
# other infrastructure. Use scripts/verify-infra.sh when disposable local
# infrastructure is explicitly desired.
pnpm -r typecheck
pnpm run lint
pnpm run lint:packages
pnpm -r test
pnpm run test:standalone
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/worker build
echo "Full source verification: PASS"
