#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0
ok() { printf '[OK]   %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1"; failures=$((failures + 1)); }

echo "== ai-comms-agent Docker preflight =="

command -v git >/dev/null 2>&1 || { fail "git is required"; }
command -v pnpm >/dev/null 2>&1 || { fail "pnpm is required"; }
command -v docker >/dev/null 2>&1 || { fail "docker is required"; }

if [[ ! -f .env.docker ]]; then fail ".env.docker is missing (run scripts/manual-up.sh once to create it)"; else ok ".env.docker exists"; fi
if [[ -f apps/web/tsconfig.json && -f apps/worker/tsconfig.json ]]; then ok "web/worker TypeScript configs exist"; else fail "web/worker TypeScript configs are missing"; fi

echo
echo "== Host TypeScript prechecks =="
if pnpm --filter @ai-comms-agent/web typecheck; then ok "web typecheck"; else fail "web typecheck"; fi
if pnpm --filter @ai-comms-agent/worker typecheck; then ok "worker typecheck"; else fail "worker typecheck"; fi

echo
echo "== Clara reference-library boundary precheck =="
if git config -f .gitmodules --get-regexp '^submodule\..*\.path$' | grep -q 'vendor/clara'; then
  ok "Clara reference-library submodule is declared (not a build input)"
else
  warn "Clara reference-library submodule is not declared; application build does not require it"
fi

if grep -Rqs 'vendor/clara/clara-core/source/src' apps packages --include='*.ts' --include='*.tsx' --exclude-dir=node_modules; then
  fail "application source directly imports the Clara reference-library source tree"
else
  ok "application source does not directly import the Clara reference-library source tree"
fi

echo
echo "== Docker configuration precheck =="
if docker compose -f infra/docker-compose.manual.yml config >/dev/null; then ok "manual Docker Compose configuration"; else fail "manual Docker Compose configuration"; fi

if (( failures > 0 )); then
  echo
  echo "Preflight FAILED: $failures check(s) failed."
  echo "Do not start the Docker build until the reported source/configuration errors are fixed."
  exit 1
fi

echo
echo "Preflight PASSED: host checks and Docker configuration are ready."
echo "Next command: bash scripts/manual-up.sh"
