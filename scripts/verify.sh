#!/usr/bin/env bash
set -euo pipefail
bash scripts/verify-docker.sh
pnpm -r typecheck
pnpm --filter @ai-comms-agent/web test
pnpm --filter @ai-comms-agent/web build
pnpm --filter @ai-comms-agent/worker build
echo "Full local verification: PASS"
