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

if [[ ! -f .env.docker ]]; then
  fail ".env.docker is missing (run scripts/manual-up.sh once to create it)"
else
  ok ".env.docker exists"
fi

if [[ ! -f .gitmodules ]]; then
  fail ".gitmodules is missing"
elif git config -f .gitmodules --get-regexp '^submodule\..*\.path$' | grep -q 'vendor/clara'; then
  git submodule sync -- vendor/clara >/dev/null
  git submodule update --init --recursive vendor/clara >/dev/null
  if [[ -f vendor/clara/clara-core/source/src/modules/ai-platform-core/clara-runtime.ts ]]; then
    ok "Clara submodule is initialized and runtime source exists"
  else
    fail "Clara runtime source is missing after submodule initialization"
  fi
else
  fail "vendor/clara submodule is not declared"
fi

if [[ -f apps/web/tsconfig.json && -f apps/worker/tsconfig.json ]]; then
  ok "web/worker TypeScript configs exist"
else
  fail "web/worker TypeScript configs are missing"
fi

echo
echo "== Host TypeScript prechecks =="

if pnpm --filter @ai-comms-agent/web typecheck; then
  ok "web typecheck"
else
  fail "web typecheck"
fi

if pnpm --filter @ai-comms-agent/worker typecheck; then
  ok "worker typecheck"
else
  fail "worker typecheck"
fi

echo
echo "== Clara import-closure precheck =="

CLARA_ROOT="vendor/clara/clara-core/source/src"
if [[ -d "$CLARA_ROOT" ]]; then
  mapfile -t CLARA_ALIASES < <(
    grep -RhoE 'from ["'\''"]@/[^"'\''"]+|import\(["'\''"]@/[^"'\''"]+["'\''"]\)' "$CLARA_ROOT" \
      | sed -E 's/.*["'\''"](@\/[^"'\''"]+).*/\1/' \
      | sort -u
  )

  missing_aliases=0
  for alias in "${CLARA_ALIASES[@]}"; do
    rel="${alias#@/}"
    if [[ "$rel" == lib/* ]]; then
      # Clara's extracted source deliberately expects a host application's
      # @/lib/* boundary. This check prevents Docker from discovering that
      # boundary only after the image build has already started.
      if [[ "$rel" == "lib/db" || "$rel" == "lib/db/"* ]]; then
        fail "Clara host-bound alias has no declared prebuild adapter: $alias"
        missing_aliases=$((missing_aliases + 1))
      fi
    fi
  done

  if (( missing_aliases == 0 )); then
    ok "no known unresolved Clara host @/lib/* aliases"
  else
    warn "$missing_aliases Clara host-bound alias(es) require an explicit host adapter before Docker build"
  fi
else
  fail "Clara source directory is unavailable"
fi

echo
echo "== Docker configuration precheck =="

if docker compose -f infra/docker-compose.manual.yml config >/dev/null; then
  ok "manual Docker Compose configuration"
else
  fail "manual Docker Compose configuration"
fi

if (( failures > 0 )); then
  echo
  echo "Preflight FAILED: $failures check(s) failed."
  echo "Do not start the Docker build until the reported source/configuration errors are fixed."
  exit 1
fi

echo
echo "Preflight PASSED: host checks and Docker configuration are ready."
echo "Next command: bash scripts/manual-up.sh"
