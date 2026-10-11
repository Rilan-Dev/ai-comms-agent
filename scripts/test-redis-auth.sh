#!/usr/bin/env bash
# Read-only Redis ACL smoke test. Does not change application files or Redis data.
set -Eeuo pipefail
set +x

REDIS_CONTAINER="redis"

read -r -p "Redis container name [redis]: " input_container
REDIS_CONTAINER="${input_container:-redis}"

read -r -p "Redis ACL username [project_c]: " REDIS_USER
REDIS_USER="${REDIS_USER:-project_c}"

read -r -p "Allowed key prefix [project-c]: " REDIS_KEY_PREFIX
REDIS_KEY_PREFIX="${REDIS_KEY_PREFIX:-project-c}"
REDIS_KEY_PREFIX="${REDIS_KEY_PREFIX%:}"

read -r -s -p "Redis password (input hidden): " REDIS_PASSWORD
printf '\n'

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker CLI is not installed or is not on PATH." >&2
  exit 2
fi

if ! docker inspect "$REDIS_CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: Cannot find Docker container '$REDIS_CONTAINER' from this shell." >&2
  echo "Run 'docker ps --format "table {{.Names}}\\t{{.Image}}"' and retry with the correct container name." >&2
  exit 2
fi

redis_cli() {
  # Pass the secret only to the redis-cli process inside the container; never print it.
  docker exec -e "REDISCLI_AUTH=$REDIS_PASSWORD" "$REDIS_CONTAINER" \
    redis-cli --no-auth-warning --user "$REDIS_USER" "$@"
}

echo
echo "1/2 Testing Redis authentication with PING..."
PING_RESULT="$(redis_cli PING 2>&1)" || {
  printf 'FAIL: Redis PING failed: %s\n' "$PING_RESULT" >&2
  unset REDIS_PASSWORD
  exit 1
}
if [[ "$PING_RESULT" != "PONG" ]]; then
  printf 'FAIL: Expected PONG; received: %s\n' "$PING_RESULT" >&2
  unset REDIS_PASSWORD
  exit 1
fi
echo "PASS: Authentication succeeded (PONG)."

echo
echo "2/2 Testing read permission for the '$REDIS_KEY_PREFIX:' namespace..."
KEY_RESULT="$(redis_cli EXISTS "${REDIS_KEY_PREFIX}:__redis_auth_probe__" 2>&1)" || {
  printf 'FAIL: Namespace permission test failed: %s\n' "$KEY_RESULT" >&2
  unset REDIS_PASSWORD
  exit 1
}
if [[ "$KEY_RESULT" =~ ^[0-9]+$ ]]; then
  echo "PASS: Redis allowed EXISTS on the requested namespace (no data was written)."
else
  printf 'FAIL: Namespace permission test returned: %s\n' "$KEY_RESULT" >&2
  echo "Check that this ACL user is allowed to access keys matching '${REDIS_KEY_PREFIX}:*'." >&2
  unset REDIS_PASSWORD
  exit 1
fi

unset REDIS_PASSWORD
echo
echo "SUCCESS: Redis authentication and namespace read-permission checks passed."
echo "This was a read-only smoke test; it did not write or delete Redis keys."
