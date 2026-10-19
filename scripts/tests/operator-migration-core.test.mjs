import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  inspectMigrationChain, assertMigrationSafe, sanitizeDatabaseLabel, assertFreshDatabaseEmpty,
} from "../../packages/db/operator-migration-core.mjs";

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "aca-migration-test-"));
  t.after(async () => { await rm(dir, { recursive: true, force: true }); });
  const sql = "SELECT 1;\n";
  await writeFile(join(dir, "0051_previous.sql"), sql);
  await writeFile(join(dir, "0052_new.sql"), "SELECT 2;\n");
  return {
    dir,
    old: { version: "0051_previous.sql", checksum: createHash("sha256").update(sql).digest("hex") },
  };
}

test("plans only unapplied files and preserves complete filename ordering", async (t) => {
  const { dir, old } = await fixture(t);
  const plan = await inspectMigrationChain(dir, [old], true);
  assert.deepEqual(plan.applied, ["0051_previous.sql"]);
  assert.deepEqual(plan.pending, ["0052_new.sql"]);
  assert.equal(plan.total, 2);
  assertMigrationSafe(plan);
  assert.throws(() => assertMigrationSafe(plan, { verify: true }), /verification incomplete/);
});

test("a fresh database is inspectable but applying requires a separate explicit flag", async (t) => {
  const { dir } = await fixture(t);
  const plan = await inspectMigrationChain(dir, [], false);
  assert.equal(plan.pending.length, 2);
  assert.throws(() => assertMigrationSafe(plan), /No aca migration ledger/);
  assert.doesNotThrow(() => assertMigrationSafe(plan, { allowFresh: true }));
  assert.throws(() => assertMigrationSafe(plan, { verify: true }), /verification incomplete/);
});

test("changed applied SQL is refused regardless of whether more files are pending", async (t) => {
  const { dir, old } = await fixture(t);
  const plan = await inspectMigrationChain(dir, [{ ...old, checksum: "bad" }], true);
  assert.deepEqual(plan.drift, ["0051_previous.sql"]);
  assert.throws(() => assertMigrationSafe(plan, { allowFresh: true }), /checksum changed/);
});

test("unknown database migration prevents accidentally deploying an older code checkout", async (t) => {
  const { dir, old } = await fixture(t);
  const plan = await inspectMigrationChain(dir, [old, { version: "9999_not_in_checkout.sql", checksum: "abc" }], true);
  assert.deepEqual(plan.unknown, ["9999_not_in_checkout.sql"]);
  assert.throws(() => assertMigrationSafe(plan), /missing from checkout/);
});

test("duplicate ledger rows and missing SQL files fail closed", async (t) => {
  const { dir, old } = await fixture(t);
  await assert.rejects(inspectMigrationChain(dir, [old, old], true), /Duplicate migration ledger/);
  const emptyDir = await mkdtemp(join(tmpdir(), "aca-migration-empty-"));
  t.after(async () => { await rm(emptyDir, { recursive: true, force: true }); });
  await assert.rejects(inspectMigrationChain(emptyDir, [], false), /No SQL migration files/);
});

test("verify requires an existing ledger and all known migration files applied", async (t) => {
  const { dir, old } = await fixture(t);
  const fileChecksum = createHash("sha256").update("SELECT 2;\n").digest("hex");
  const plan = await inspectMigrationChain(dir, [old, { version: "0052_new.sql", checksum: fileChecksum }], true);
  assert.doesNotThrow(() => assertMigrationSafe(plan, { verify: true }));
});

test("operator database label validation rejects URLs, secrets, and paths", () => {
  assert.equal(sanitizeDatabaseLabel("aca"), "aca");
  for (const label of ["", "postgres://a:b@host/db", "aca;DROP TABLE", "db/name", " name", "a".repeat(64)]) {
    assert.throws(() => sanitizeDatabaseLabel(label), /database identifier/);
  }
});

test("--allow-fresh permits only a positively verified empty database", () => {
  assert.doesNotThrow(() => assertFreshDatabaseEmpty(false));
  assert.throws(() => assertFreshDatabaseEmpty(true), /Fresh migration refused: user relations already exist/);
  for (const unknown of [undefined, null, 0, "false", "f", {}]) {
    assert.throws(() => assertFreshDatabaseEmpty(unknown), /emptiness could not be confirmed/);
  }
});
