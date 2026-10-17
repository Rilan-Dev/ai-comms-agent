import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../manual-up.sh", import.meta.url), "utf8");

test("manual deployment runs migrations in a one-off Docker container with internal DNS", () => {
  assert.match(script, /Applying database migrations inside Docker/);
  assert.match(script, /"\$\{COMPOSE\[@\]\}" run --rm --no-deps/);
  assert.match(script, /--volume "\$PROJECT_ROOT\/supabase:\/workspace\/supabase:ro"/);
  assert.match(script, /web node packages\/db\/migrate\.js; then/);
  assert.ok(
    script.indexOf("--no-deps") < script.indexOf("--volume") &&
      script.indexOf("--volume") < script.indexOf("web node packages/db/migrate.js"),
    "migration container must mount supabase migrations before running the migration command",
  );
  assert.doesNotMatch(script, /DATABASE_URL="\$migration_db_url" node packages\/db\/migrate\.js/);
  assert.doesNotMatch(script, /migration_db_url/);
  assert.doesNotMatch(script, /host\.docker\.internal\/127\.0\.0\.1/);
});

test("migration execution uses Compose service environment, not host-side DSN resolution", async () => {
  assert.doesNotMatch(script, /config --environment/);
  assert.doesNotMatch(script, /migration_db_url/);
  const compose = await readFile(new URL("../../docker-compose.yml", import.meta.url), "utf8");
  assert.equal(compose.split("      - .env").length - 1, 2);
  assert.equal(compose.includes("../.env"), false);
});

test("manual deployment does not print a resolved database URL", () => {
  assert.doesNotMatch(script, /echo ["'].*\$migration_db_url/);
});

test("containerized migration keeps the existing startup-on-failure policy", () => {
  assert.match(script, /WARNING: Migration runner exited with status \$migration_status/);
  assert.match(script, /Continuing with container startup, as requested/);
});
