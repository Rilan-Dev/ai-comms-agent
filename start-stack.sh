#!/usr/bin/env bash
# Idempotent stack launcher. Safe to call repeatedly.
# Starts Next.js web (port 3000) and worker if not already running.
set -uo pipefail

cd /home/z/my-project/ai-comms-agent

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
  # IMPORTANT: the sandbox has a polluted DATABASE_URL=file:/home/z/my-project/db/custom.db
  # that Next.js would pick up before apps/web/.env.local. We must explicitly
  # export the real DATABASE_URL (and friends) here so the web app reaches
  # the real Prisma Postgres.
  setsid bash -c 'cd /home/z/my-project/ai-comms-agent && set -a; source .env.docker; set +a; exec pnpm --filter @ai-comms-agent/web start' > web.log 2>&1 < /dev/null &
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
  setsid bash -c 'cd /home/z/my-project/ai-comms-agent && set -a; source .env.docker; set +a; exec pnpm --filter @ai-comms-agent/worker start' > worker.log 2>&1 < /dev/null &
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
