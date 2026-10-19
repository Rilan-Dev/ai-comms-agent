#!/usr/bin/env bash
set -euo pipefail

# Explicitly provision ONLY the disposable C1/C3 briefing test fixture.
# Never run implicitly or against a production database.
NAME="ai-comms-c1-testdb"
TEST_URL="postgresql://postgres@127.0.0.1:55432/ai_comms_c1_test"
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

die() { printf '[briefing-testdb] ERROR: %s\n' "$*" >&2; exit 1; }
[[ "${BRIEFING_TEST_DATABASE_OPT_IN:-}" == "disposable-local-c1" ]] ||
  die 'Explicit opt-in required: BRIEFING_TEST_DATABASE_OPT_IN=disposable-local-c1'
[[ "${BRIEFING_TEST_DATABASE_URL:-$TEST_URL}" == "$TEST_URL" ]] ||
  die 'Refusing non-test BRIEFING_TEST_DATABASE_URL'
command -v docker >/dev/null 2>&1 || die 'Docker CLI not found'
command -v node >/dev/null 2>&1 || die 'Node.js is required for Docker inspection'
[[ -f "$ROOT/infra/postgres-init/00-supabase-roles.sql" ]] ||
  die 'Missing disposable role bootstrap SQL'

# Verify existing containers BEFORE touching them. Reject a name collision
# with any non-tmpfs, non-loopback or wrong-database PostgreSQL instance.
inspect_safe() {
  docker inspect "$NAME" | node -e '
    let raw="";
    process.stdin.on("data", chunk => raw += chunk);
    process.stdin.on("end", () => {
      try {
        const c = JSON.parse(raw)[0];
        const ports = c?.HostConfig?.PortBindings?.["5432/tcp"];
        const mount = c?.HostConfig?.Tmpfs?.["/var/lib/postgresql/data"];
        const env = c?.Config?.Env ?? [];
        if (!Array.isArray(ports) || ports.length !== 1 ||
            ports[0].HostIp !== "127.0.0.1" || ports[0].HostPort !== "55432" ||
            typeof mount !== "string" ||
            !env.includes("POSTGRES_DB=ai_comms_c1_test") ||
            !env.includes("POSTGRES_USER=postgres") ||
            !env.includes("POSTGRES_HOST_AUTH_METHOD=trust") ||
            !String(c?.Config?.Image ?? "").startsWith("postgres:16")) {
          process.stderr.write("Existing container does not match disposable fixture contract\n");
          process.exitCode = 1;
        }
      } catch {
        process.stderr.write("Unable to verify Docker container identity\n");
        process.exitCode = 1;
      }
    });
  '
}

if docker container inspect "$NAME" >/dev/null 2>&1; then
  inspect_safe || die 'Container name collision or unsafe configuration; no changes made'
  if [[ "$(docker inspect --format '{{.State.Running}}' "$NAME")" != "true" ]]; then
    docker start "$NAME" >/dev/null || die 'Could not start disposable test container'
  fi
else
  # No named volumes and no external network binding. Passwordless trust auth
  # is appropriate ONLY for this disposable loopback test container.
  docker run --detach \
    --name "$NAME" \
    --publish 127.0.0.1:55432:5432 \
    --tmpfs /var/lib/postgresql/data:rw,nosuid,size=512m \
    --mount "type=bind,source=$ROOT/infra/postgres-init,target=/docker-entrypoint-initdb.d,readonly" \
    --env POSTGRES_DB=ai_comms_c1_test \
    --env POSTGRES_USER=postgres \
    --env POSTGRES_HOST_AUTH_METHOD=trust \
    --label ai-comms.disposable-briefing-testdb=true \
    postgres:16-alpine >/dev/null ||
    die 'Container creation failed; check whether localhost port 55432 is occupied'
fi

inspect_safe || die 'Post-start container did not meet strict fixture contract'

ready=false
for _ in $(seq 1 40); do
  if docker exec "$NAME" pg_isready -U postgres -d ai_comms_c1_test >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || die 'Test PostgreSQL did not become ready (docker logs ai-comms-c1-testdb)'

# Idempotently prepare compatibility roles in this disposable DB only.
# No reads or writes to the real application DATABASE_URL.
docker exec -i "$NAME" psql -X -v ON_ERROR_STOP=1 \
  -U postgres -d ai_comms_c1_test \
  < "$ROOT/infra/postgres-init/00-supabase-roles.sql" >/dev/null

docker exec -i "$NAME" psql -X -v ON_ERROR_STOP=1 \
  -U postgres -d ai_comms_c1_test >/dev/null <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'c1_fixture') THEN
    CREATE ROLE c1_fixture LOGIN;
  END IF;
END
$$;
SQL

printf '[briefing-testdb] Disposable localhost PostgreSQL ready.\n'
printf '[briefing-testdb] Run:\n'
printf 'BRIEFING_TEST_DATABASE_OPT_IN=disposable-local-c1 \\\n'
printf 'BRIEFING_TEST_DATABASE_URL=%s \\\n' "$TEST_URL"
printf 'node --test packages/db/tests/briefing-c3-canonical.integration.test.mjs\n'
