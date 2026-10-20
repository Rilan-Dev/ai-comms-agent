import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  databaseTargetFromEnvironment,
  describeDatabaseFailure,
  checkManualDatabaseConnection,
} from "../../packages/db/manual-db-preflight.mjs";

test("reads only hostname, port and database from configured target", () => {
  assert.deepEqual(databaseTargetFromEnvironment({
    DATABASE_URL: "postgresql://operator:confidential@host.docker.internal:65432/aca"
  }), { host: "host.docker.internal", port: "65432", database: "aca" });
});

test("missing and malformed connection strings fail before DB access", () => {
  assert.throws(() => databaseTargetFromEnvironment({}), /missing/);
  assert.throws(() => databaseTargetFromEnvironment({ DATABASE_URL: "not-a-url" }), /valid PostgreSQL URL/);
  assert.throws(() => databaseTargetFromEnvironment({ DATABASE_URL: "redis://db/aca" }), /PostgreSQL hostname/);
});

test("Docker service DNS failure explains optional Postgres and external-host fix", () => {
  const message = describeDatabaseFailure({ code: "ENOTFOUND", message: "private-password" }, "postgres");
  assert.match(message, /local-infra/);
  assert.match(message, /--no-deps/);
  assert.match(message, /host\.docker\.internal/);
  assert.doesNotMatch(message, /private-password/);
});

test("credential errors remain redacted and cannot leak connection strings", () => {
  const message = describeDatabaseFailure({
    code: "28P01", message: "password bad: postgres://name:secret@localhost"
  }, "localhost");
  assert.match(message, /authentication failed/);
  assert.doesNotMatch(message, /secret|postgres:\/\//);
});

test("read-only probe checks current database identity and closes pool", async () => {
  let closed = false;
  class FakePool {
    constructor(options) {
      assert.equal(options.connectionTimeoutMillis, 7_000);
      assert.equal(options.max, 1);
    }
    async query(sql) {
      assert.equal(sql, "SELECT current_database() AS database_name");
      return { rows: [{ database_name: "aca" }] };
    }
    async end() { closed = true; }
  }
  assert.deepEqual(await checkManualDatabaseConnection({
    DATABASE_URL: "postgresql://operator:secret@host.docker.internal:65432/aca",
    DATABASE_SSL: "false",
  }, FakePool), { host: "host.docker.internal", port: "65432", database: "aca" });
  assert.equal(closed, true);
});

test("probe rejects substituted database identity and still closes pool", async () => {
  let closed = false;
  class FakePool {
    async query() { return { rows: [{ database_name: "different" }] }; }
    async end() { closed = true; }
  }
  await assert.rejects(checkManualDatabaseConnection({
    DATABASE_URL: "postgresql://operator:secret@localhost:5432/aca",
  }, FakePool), /DATABASE_IDENTITY_MISMATCH/);
  assert.equal(closed, true);
});

test("manual deployment probes application DB before migrations and startup", () => {
  const root = resolve(import.meta.dirname, "../..");
  const script = readFileSync(resolve(root, "scripts/manual-up.sh"), "utf8");
  const check = script.indexOf("node packages/db/manual-db-preflight.mjs");
  const migrate = script.indexOf("web node packages/db/migrate.js");
  const start = script.indexOf("up -d");
  assert.ok(check >= 0 && check < migrate && migrate < start);
  assert.match(script, /Skipping migrations and startup/);
  assert.match(script, /migration failed; not starting services/);
  assert.doesNotMatch(script, /Continuing with container startup/);
});
