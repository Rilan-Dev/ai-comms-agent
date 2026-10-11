#!/usr/bin/env bash
set -euo pipefail

# Safe external-service diagnostics. This script never prints credentials.
# Usage:
#   bash scripts/check-services.sh
#   bash scripts/check-services.sh .env.docker
#
# It checks configuration shape, DNS/TCP reachability, PostgreSQL authentication
# (when psql is available), and Qdrant HTTP health. Redis/RabbitMQ use TCP
# reachability unless their native CLIs are installed.

ENV_FILE="${1:-.env.docker}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  echo "Create it from .env.docker.example or pass the correct env file path." >&2
  exit 2
fi

# Read only simple KEY=value lines. Do not source the env file as shell code.
get_env() {
  local key="$1"
  awk -v key="$key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line=$0
      sub(/^[[:space:]]*/, "", line)
      if (index(line, key "=") == 1) {
        value=substr(line, length(key)+2)
        sub(/[[:space:]]+#.*$/, "", value)
        dq=sprintf("%c",34)
        sq=sprintf("%c",39)
        if (substr(value,1,1)==dq || substr(value,1,1)==sq) value=substr(value,2)
        if (substr(value,length(value),1)==dq || substr(value,length(value),1)==sq) value=substr(value,1,length(value)-1)
        print value
        exit
      }
    }
  ' "$ENV_FILE"
}

mask_url() {
  local url="$1"
  if [[ -z "$url" ]]; then
    echo "(unset)"
    return
  fi
  printf '%s\n' "$url" | sed -E 's#(://[^:/]+:)[^@]+@#\1***@#'
}

url_host() {
  python3 - "$1" <<'PY' 2>/dev/null || true
import sys
from urllib.parse import urlparse
u = urlparse(sys.argv[1])
print(u.hostname or "")
PY
}

url_port() {
  python3 - "$1" <<'PY' 2>/dev/null || true
import sys
from urllib.parse import urlparse
u = urlparse(sys.argv[1])
print(u.port or "")
PY
}

host_for_local_check() {
  local host="$1"
  # host.docker.internal is the correct endpoint inside Docker containers.
  # From the Windows/Linux host running this diagnostic, the published service
  # ports are reached through loopback instead.
  if [[ "$host" == "host.docker.internal" ]]; then
    echo "127.0.0.1"
  else
    echo "$host"
  fi
}

tcp_check() {
  local host="$1" port="$2"
  local target_host
  target_host="$(host_for_local_check "$host")"
  if [[ -z "$target_host" || -z "$port" ]]; then
    echo "SKIP (host/port could not be parsed)"
    return 2
  fi
  if command -v nc >/dev/null 2>&1; then
    if nc -z -w 5 "$target_host" "$port" >/dev/null 2>&1; then
      echo "PASS TCP $host:$port"
      return 0
    fi
  elif command -v timeout >/dev/null 2>&1; then
    if timeout 5 bash -c "</dev/tcp/$target_host/$port" >/dev/null 2>&1; then
      echo "PASS TCP $host:$port"
      return 0
    fi
  fi
  echo "FAIL TCP $host:$port (DNS/route/firewall/service unavailable)"
  return 1
}

failures=0
echo "=== ai-comms-agent external service diagnostics ==="
echo "Environment file: $ENV_FILE"
echo

database_url="$(get_env DATABASE_URL)"
redis_url="$(get_env REDIS_URL)"
rabbit_url="$(get_env RABBITMQ_URL)"
qdrant_url="$(get_env QDRANT_URL)"

echo "[configuration]"
printf 'DATABASE_URL=%s\n' "$(mask_url "$database_url")"
printf 'REDIS_URL=%s\n' "$(mask_url "$redis_url")"
printf 'RABBITMQ_URL=%s\n' "$(mask_url "$rabbit_url")"
printf 'QDRANT_URL=%s\n' "$(mask_url "$qdrant_url")"
echo

echo "[PostgreSQL]"
if [[ -z "$database_url" ]]; then
  echo "FAIL DATABASE_URL is unset"
  failures=$((failures+1))
else
  db_host="$(url_host "$database_url")"
  db_port="$(url_port "$database_url")"
  echo "Target: $(mask_url "$database_url")"
  if [[ "$db_host" == "postgres-db" || "$db_host" == "postgres" || "$db_host" == "db" ]]; then
    echo "WARNING: '$db_host' is a Docker-network hostname. It is not reachable from the host and is not a valid external endpoint for the manual app stack."
  fi
  if command -v psql >/dev/null 2>&1; then
    local_db_url="$database_url"
    if [[ "$db_host" == "host.docker.internal" ]]; then
      # The host-side shell cannot normally resolve host.docker.internal.
      # Replace only the authority hostname after the optional userinfo.
      local_db_url="$(printf '%s' "$database_url" | sed -E 's#@host\.docker\.internal(:[0-9]+)#@127.0.0.1\1#')"
    fi
    if PGCONNECT_TIMEOUT=5 psql "$local_db_url" -X -v ON_ERROR_STOP=1 -Atqc "select current_database() || '|' || current_user || '|' || version();" >/tmp/aca-pg-check.out 2>/tmp/aca-pg-check.err; then
      echo "PASS PostgreSQL authentication/query"
      cat /tmp/aca-pg-check.out
    else
      echo "FAIL PostgreSQL authentication/query"
      sed -E 's/(password|passwd|pwd|secret|token)=([^& ]+)/\1=***/Ig' /tmp/aca-pg-check.err
      failures=$((failures+1))
    fi
  else
    if ! tcp_check "$db_host" "$db_port"; then failures=$((failures+1)); fi
    echo "NOTE: psql is not installed, so only TCP reachability was tested."
  fi
fi
echo

echo "[Redis]"
if [[ -z "$redis_url" ]]; then
  echo "SKIP REDIS_URL is unset"
else
  redis_host="$(url_host "$redis_url")"; redis_port="$(url_port "$redis_url")"
  if ! tcp_check "$redis_host" "${redis_port:-6379}"; then failures=$((failures+1)); fi
fi
echo

echo "[RabbitMQ]"
if [[ -z "$rabbit_url" ]]; then
  echo "SKIP RABBITMQ_URL is unset"
else
  rabbit_host="$(url_host "$rabbit_url")"; rabbit_port="$(url_port "$rabbit_url")"
  if ! tcp_check "$rabbit_host" "${rabbit_port:-5672}"; then failures=$((failures+1)); fi
fi
echo

echo "[Qdrant]"
if [[ -z "$qdrant_url" ]]; then
  echo "SKIP QDRANT_URL is unset"
elif command -v curl >/dev/null 2>&1; then
  local_qdrant_url="$qdrant_url"
  if [[ "$(url_host "$qdrant_url")" == "host.docker.internal" ]]; then
    local_qdrant_url="$(printf '%s' "$qdrant_url" | sed 's#://host\.docker\.internal#://127.0.0.1#')"
  fi
  if curl --fail --silent --show-error --max-time 8 "${local_qdrant_url%/}/healthz" >/tmp/aca-qdrant-check.out 2>/tmp/aca-qdrant-check.err; then
    echo "PASS Qdrant HTTP health"
    cat /tmp/aca-qdrant-check.out
  elif curl --fail --silent --show-error --max-time 8 "${local_qdrant_url%/}" >/tmp/aca-qdrant-check.out 2>/tmp/aca-qdrant-check.err; then
    echo "PASS Qdrant HTTP endpoint reachable"
    cat /tmp/aca-qdrant-check.out
  else
    echo "FAIL Qdrant HTTP endpoint"
    cat /tmp/aca-qdrant-check.err
    failures=$((failures+1))
  fi
else
  echo "SKIP curl is not installed"
fi
echo

rm -f /tmp/aca-pg-check.out /tmp/aca-pg-check.err /tmp/aca-qdrant-check.out /tmp/aca-qdrant-check.err

if [[ "$failures" -eq 0 ]]; then
  echo "=== SERVICE DIAGNOSTICS: PASS ==="
else
  echo "=== SERVICE DIAGNOSTICS: FAIL ($failures check(s)) ==="
  exit 1
fi
