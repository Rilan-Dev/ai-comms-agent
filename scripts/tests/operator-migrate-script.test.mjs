import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { findUnsafeMigrationDeclarations } from "../../scripts/check-migration-declarations.mjs";
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


test("operator migration checker and core are valid Node modules", () => {
  for (const file of [
    "packages/db/operator-migration-check.mjs",
    "packages/db/operator-migration-core.mjs",
    "scripts/check-migration-declarations.mjs",
  ]) {
    const result = spawnSync("node", ["--check", resolve(root, file)], { encoding: "utf8" });
    assert.equal(result.status, 0, file + ": " + result.stderr);
  }
});

const baseMigrations = [
  "0001_identity_rbac.sql", "0002_database_foundation.sql",
  "0003_email_domain.sql", "0004_messaging.sql",
  "0005_agent_policy_configuration.sql", "0006_conversations_scheduling.sql",
  "0007_actions_ai_voice_audit.sql", "0008_api_keys_knowledge_storage.sql",
  "0009_rls_helper_hardening.sql", "0010_cross_tenant_integrity.sql",
  "0011_ownership_transfer.sql", "0012_server_identity_rpcs.sql",
  "0013_database_security_hardening.sql", "0014_email_connection_config.sql",
];

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "aca-chain-structure-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const file of baseMigrations) writeFileSync(join(dir, file), "SELECT 1;\n");
  return dir;
}

function structureCheck(dir) {
  return spawnSync("bash", [resolve(root, "scripts/verify-migration-chain.sh")], {
    encoding: "utf8", env: { ...process.env, MIGRATIONS_DIR: dir },
  });
}

test("historical idempotent qualified tables and guarded enums are not unsafe duplicates", () => {
  const declarations = [
    { version: "0001.sql", sql: `CREATE TABLE IF NOT EXISTS agents (id integer);
DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('active'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
    { version: "0002.sql", sql: `CREATE TABLE IF NOT EXISTS aca.agents (id integer);
DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('active'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
  ];
  assert.deepEqual(findUnsafeMigrationDeclarations(declarations), []);
});

test("static checker rejects genuinely repeated unguarded table and enum DDL, by schema", () => {
  const declarations = [
    { version: "first.sql", sql: "CREATE TABLE aca.unprotected (id integer);\nCREATE TYPE aca.flag AS ENUM ('x');" },
    { version: "second.sql", sql: "CREATE TABLE unprotected (id integer);\nCREATE TYPE aca.flag AS ENUM ('x');" },
  ];
  const failures = findUnsafeMigrationDeclarations(declarations);
  assert.equal(failures.length, 2);
  assert.match(failures.join(" "), /non-idempotent table definition aca.unprotected/);
  assert.match(failures.join(" "), /non-idempotent enum definition aca.flag/);
});

test("different schemas and CREATE statements inside SQL comments or DO blocks do not collide", () => {
  const declarations = [
    { version: "first.sql", sql: "CREATE TABLE public.events (id integer);\n-- CREATE TABLE aca.events (id integer);\nDO $body$ BEGIN CREATE TYPE aca.flag AS ENUM ('a'); EXCEPTION WHEN duplicate_object THEN NULL; END $body$;" },
    { version: "second.sql", sql: "/* CREATE TABLE aca.events (id integer); */\nCREATE TABLE aca.events (id integer);" },
  ];
  assert.deepEqual(findUnsafeMigrationDeclarations(declarations), []);
});

test("complete migration structure check accepts idempotent historical reconciliation SQL", (t) => {
  const dir = fixture(t);
  const type = "DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('active'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;";
  writeFileSync(join(dir, "0001_identity_rbac.sql"), `CREATE TABLE IF NOT EXISTS agents (id integer);\n${type}\n`);
  writeFileSync(join(dir, "0002_database_foundation.sql"), `CREATE TABLE IF NOT EXISTS aca.agents (id integer);\n${type}\n`);
  const result = structureCheck(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Migration declaration safety: PASS/);
  assert.match(result.stdout, /Migration chain structure: PASS/);
});

test("complete migration structure check still rejects repeated unsafe DDL", (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, "0001_identity_rbac.sql"), "CREATE TABLE aca.unsafe_table (id integer);\n");
  writeFileSync(join(dir, "0002_database_foundation.sql"), "CREATE TABLE unsafe_table (id integer);\n");
  const result = structureCheck(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /non-idempotent table definition aca.unsafe_table/);
});
