#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --import ./apps/worker/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 apps/web/tests/*.test.mjs scripts/tests/*.test.mjs
