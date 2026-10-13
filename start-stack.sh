#!/usr/bin/env bash
# Idempotent stack launcher. Safe to call repeatedly.
# Starts Next.js web (port 3000) and worker if not already running.
set -uo pipefail

# Auto-detect repo root from this script's location.
# start-stack.sh lives at <repo-root>/start-stack.sh, so the repo root is
# the directory this script is in. Works regardless of the absolute
# checkout path (e.g., /docker/ai-comms-agent on the user's local machine,
# /opt/apps/comms-agent in another environment, or a CI runner workspace).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
cd "$REPO_ROOT"

# Check if web is up
web_up=0
if curl -s -m 2 -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
  web_up=1
fi

# Check if worker is up by inspecting processes (no easy HTTP probe)
worker_up=0
if pgrep -f "tsx src/index.ts" >/dev/null 2>&1; then
  worker_up=1
fi

if [[ "$web_up" -eq 0 ]]; then
  echo "[stack] starting web…"
  rm -f web.log
  # Source .env.docker explicitly so the web app picks up the real
  # DATABASE_URL (and friends) rather than any ambient shell env. This
  # matters when the parent shell has a stale DATABASE_URL pointing at
  # a different DB (e.g., a sandbox's file: DB). The cd ensures the
  # .env.docker file resolves relative to the repo root regardless of
  # where the parent shell is.
  setsid bash -c "cd \"$REPO_ROOT\" && set -a; source .env.docker; set +a; exec pnpm --filter @ai-comms-agent/web start" > web.log 2>&1 < /dev/null &
  disown
  # Wait up to 20s for ready
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    if curl -s -m 2 -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
      echo "[stack] web ready after ${i}x2s"
      web_up=1
      break
    fi
  done
  if [[ "$web_up" -eq 0 ]]; then
    echo "[stack] web FAILED to come up — last 30 log lines:" >&2
    tail -30 web.log >&2
  fi
else
  echo "[stack] web already up"
fi

if [[ "$worker_up" -eq 0 ]]; then
  echo "[stack] starting worker…"
  rm -f worker.log
  setsid bash -c "cd \"$REPO_ROOT\" && set -a; source .env.docker; set +a; exec pnpm --filter @ai-comms-agent/worker start" > worker.log 2>&1 < /dev/null &
  disown
  sleep 4
  if pgrep -f "tsx src/index.ts" >/dev/null 2>&1; then
    echo "[stack] worker ready"
  else
    echo "[stack] worker FAILED to start — last 30 log lines:" >&2
    tail -30 worker.log >&2
  fi
else
  echo "[stack] worker already up"
fi

echo "[stack] health:"
curl -s -m 5 http://localhost:3000/api/health 2>&1
echo ""
