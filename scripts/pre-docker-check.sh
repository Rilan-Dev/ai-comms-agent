#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0
ok() { printf '[OK]   %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1"; }

run_typecheck_excluding_vendor() {
  local label="$1"
  shift
  local output_file
  output_file="$(mktemp)"
  trap 'rm -f "$output_file"' RETURN

  if "$@" >"$output_file" 2>&1; then
    ok "$label typecheck"
    return 0
  fi

  # vendor/clara is a reference-only source tree. Its transitive TypeScript
  # diagnostics are intentionally outside this preflight's application scope.
  # Keep any application diagnostics visible and failing.
  if awk '
    /^[^[:space:]].* - error TS[0-9]+:/ {
      if ($0 !~ /(^|\/|\.\.\/)vendor\/clara\//) { non_vendor=1 }
    }
    END { exit non_vendor ? 1 : 0 }
  ' "$output_file"; then
    warn "$label typecheck has only vendor/clara diagnostics (excluded from preflight)"
    return 0
  fi

  cat "$output_file"
  return 1
}

echo "== ai-comms-agent Docker preflight =="

command -v git >/dev/null 2>&1 || { fail "git is required"; failures=$((failures + 1)); }
command -v pnpm >/dev/null 2>&1 || { fail "pnpm is required"; failures=$((failures + 1)); }
command -v docker >/dev/null 2>&1 || { fail "docker is required"; failures=$((failures + 1)); }

if [[ ! -f .env.docker ]]; then fail ".env.docker is missing (run scripts/manual-up.sh once to create it)"; failures=$((failures + 1)); else ok ".env.docker exists"; fi
if [[ -f apps/web/tsconfig.json && -f apps/worker/tsconfig.json ]]; then ok "web/worker TypeScript configs exist"; else fail "web/worker TypeScript configs are missing"; failures=$((failures + 1)); fi

echo
echo "== Host TypeScript prechecks =="
if ! run_typecheck_excluding_vendor "web" pnpm --filter @ai-comms-agent/web typecheck; then failures=$((failures + 1)); fi
if ! run_typecheck_excluding_vendor "worker" pnpm --filter @ai-comms-agent/worker typecheck; then failures=$((failures + 1)); fi

echo
echo "== Docker configuration precheck =="
if docker compose -f infra/docker-compose.yml config >/dev/null; then ok "manual Docker Compose configuration"; else fail "manual Docker Compose configuration"; failures=$((failures + 1)); fi

if (( failures > 0 )); then
  echo
  echo "Preflight FAILED: $failures check(s) failed."
  echo "Do not start the Docker build until the reported application/configuration errors are fixed."
  exit 1
fi

echo
echo "Preflight PASSED: host application checks and Docker configuration are ready."
echo "Note: vendor/clara is reference-only and excluded from preflight TypeScript diagnostics."
echo "Next command: bash scripts/manual-up.sh"
