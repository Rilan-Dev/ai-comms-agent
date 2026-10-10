#!/usr/bin/env bash
# Exercise Redis SET NX PX and token-checked Lua release using a temporary namespaced key.
# This writes one short-lived probe key, then removes it only if its value still matches our token.
set -Eeuo pipefail
set +x

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
  echo "ERROR: Cannot find Docker container '$REDIS_CONTAINER'." >&2
  exit 2
fi

redis_cli() {
  docker exec -e "REDISCLI_AUTH=$REDIS_PASSWORD" "$REDIS_CONTAINER" \
    redis-cli --no-auth-warning --user "$REDIS_USER" "$@"
}

TOKEN="redis-lease-probe-$(date +%s)-$$"
OTHER_TOKEN="${TOKEN}-wrong"
KEY="${REDIS_KEY_PREFIX}:__lease_probe__:$TOKEN"
ACQUIRED=0
cleanup() {
  if [[ "$ACQUIRED" == "1" ]]; then
    # Compare-and-delete: never delete a key whose value no longer matches our token.
    redis_cli EVAL "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end" 1 "$KEY" "$TOKEN" >/dev/null 2>&1 || true
  fi
  unset REDIS_PASSWORD
}
trap cleanup EXIT

echo
echo "1/4 Testing lease acquisition (SET NX PX)..."
RESULT="$(redis_cli SET "$KEY" "$TOKEN" NX PX 15000 2>&1)" || {
  printf 'FAIL: Lease acquisition returned: %s\n' "$RESULT" >&2
  exit 1
}
if [[ "$RESULT" != "OK" ]]; then
  printf 'FAIL: Expected OK from first acquisition; received: %s\n' "$RESULT" >&2
  exit 1
fi
ACQUIRED=1
echo "PASS: First acquisition succeeded."

echo
echo "2/4 Testing mutual exclusion..."
RESULT="$(redis_cli SET "$KEY" "$OTHER_TOKEN" NX PX 15000 2>&1)" || {
  printf 'FAIL: Second acquisition returned: %s\n' "$RESULT" >&2
  exit 1
}
if [[ "$RESULT" != "(nil)" ]]; then
  printf 'FAIL: Expected second acquisition to be rejected (nil); received: %s\n' "$RESULT" >&2
  exit 1
fi
echo "PASS: A second token cannot acquire the active lease."

echo
echo "3/4 Testing that a wrong token cannot release the lease..."
RESULT="$(redis_cli EVAL "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end" 1 "$KEY" "$OTHER_TOKEN" 2>&1)" || {
  printf 'FAIL: Wrong-token release returned: %s\n' "$RESULT" >&2
  exit 1
}
if [[ "$RESULT" != "0" ]]; then
  printf 'FAIL: Expected wrong-token release to return 0; received: %s\n' "$RESULT" >&2
  exit 1
fi
echo "PASS: Wrong token cannot release another holder's lease."

echo
echo "4/4 Testing release by the correct token..."
RESULT="$(redis_cli EVAL "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end" 1 "$KEY" "$TOKEN" 2>&1)" || {
  printf 'FAIL: Correct-token release returned: %s\n' "$RESULT" >&2
  exit 1
}
if [[ "$RESULT" != "1" ]]; then
  printf 'FAIL: Expected correct-token release to return 1; received: %s\n' "$RESULT" >&2
  exit 1
fi
ACQUIRED=0
echo "PASS: Correct token released the lease."

unset REDIS_PASSWORD
echo
echo "SUCCESS: Redis lease operations passed."
echo "A temporary key under '$REDIS_KEY_PREFIX:' was created and then removed."
