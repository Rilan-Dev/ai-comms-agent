import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const path = resolve(root, "scripts/operator-migrate.sh");
const script = readFileSync(path, "utf8");
const checker = readFileSync(resolve(root, "packages/db/operator-migration-check.mjs"), "utf8");

test("operator migration wrapper has valid Bash syntax", () => {
  const result = spawnSync("bash", ["-n", path], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("apply fails before touching Docker without target and backup confirmation", () => {
  for (const args of [["apply"], ["apply", "--expect-db", "aca"]]) {
    const result = spawnSync("bash", [path, ...args], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr);
  }
});

test("new-database switch never works for a read-only mode", () => {
  const result = spawnSync("bash", [path, "plan", "--allow-fresh"], { encoding: "utf8" });
  assert.equal(result.status, 2);
});

test("uses Compose internal network, pinned env file and read-only SQL mount", () => {
  assert.match(script, /docker compose --project-directory "\$ROOT" --env-file "\$ENV_FILE"/);
  assert.match(script, /ENV_FILE="\$ROOT\/\.env"/);
  assert.match(script, /--no-deps/);
  assert.match(script, /--volume "\$ROOT\/supabase:\/workspace\/supabase:ro"/);
  assert.match(script, /node packages\/db\/operator-migration-check\.mjs preflight/);
  assert.match(script, /node packages\/db\/migrate\.js/);
  assert.match(script, /node packages\/db\/operator-migration-check\.mjs verify/);
  assert.doesNotMatch(script, /reset-and-migrate|DROP SCHEMA|docker compose.*up -d/);
});

test("fails closed when existing migrate.js skips permission/duplicate errors", () => {
  assert.match(script, /privilege_warnings\|already_exists_skips/);
  assert.match(script, /migration runner did not confirm completion/);
  assert.match(script, /migration runner failed/);
  assert.match(script, /--backup-confirmed/);
});

test("read-only checker verifies exact target database and ledger integrity", () => {
  assert.match(checker, /current_database\(\)/);
  assert.match(checker, /expectedDb !== databaseName/);
  assert.match(checker, /aca\._aca_schema_migrations/);
  assert.match(checker, /assertMigrationSafe/);
  assert.match(checker, /UNKNOWN_APPLIED/);
  assert.match(checker, /CHECKSUM_MISMATCH/);
  assert.doesNotMatch(checker, /console\.log\(.*DATABASE_URL/);
});
