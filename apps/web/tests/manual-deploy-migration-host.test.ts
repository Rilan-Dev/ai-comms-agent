import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("manual deployment migration host boundary", () => {
  it("rewrites Docker-only hostname for host-side psql while preserving the container URL", () => {
    const script = readFileSync(resolve(__dirname, "../../../scripts/manual-up.sh"), "utf8");
    expect(script).toContain('migration_db_url="${migration_db_url//host.docker.internal/127.0.0.1}"');
    expect(script).toContain('DATABASE_URL="$migration_db_url" bash scripts/migrate.sh');
    expect(script).toContain('docker compose --env-file .env.docker -f infra/docker-compose.manual.yml up -d');
  });
});
