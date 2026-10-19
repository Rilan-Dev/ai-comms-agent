/**
 * Non-mutating database target, ledger and checksum inspection.
 * Invoke from the SAME Compose web image/environment as migrate.js.
 *
 * node packages/db/operator-migration-check.mjs plan
 * node packages/db/operator-migration-check.mjs preflight --expect-db aca
 * node packages/db/operator-migration-check.mjs verify --expect-db aca
 */
import { Client } from "pg";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFreshDatabaseEmpty, assertMigrationSafe, inspectMigrationChain, sanitizeDatabaseLabel } from "./operator-migration-core.mjs";

const modes = new Set(["plan", "preflight", "verify"]);
const args = process.argv.slice(2);
const mode = args.shift();
if (!modes.has(mode)) {
  console.error("Usage: operator-migration-check.mjs plan|preflight|verify [--expect-db NAME] [--allow-fresh]");
  process.exit(2);
}
let expectedDb = null;
let allowFresh = false;
while (args.length) {
  const arg = args.shift();
  if (arg === "--expect-db") {
    if (!args.length || expectedDb) throw new Error("--expect-db requires one database name.");
    expectedDb = sanitizeDatabaseLabel(args.shift());
  } else if (arg === "--allow-fresh") {
    allowFresh = true;
  } else {
    throw new Error("Unknown migration check argument: " + arg);
  }
}
if (mode !== "plan" && !expectedDb) throw new Error("--expect-db is required for preflight and verification.");
if (mode !== "preflight" && allowFresh) throw new Error("--allow-fresh is valid only during preflight.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be configured inside the migration container.");

const directory = resolve(fileURLToPath(new URL("../../supabase/migrations", import.meta.url)));
const url = process.env.DATABASE_URL;
const client = new Client({
  connectionString: url,
  // Match the existing pg migration runner's deployment compatibility.
  ssl: url.includes("sslmode=require") ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  const identity = await client.query("SELECT current_database() AS database_name");
  const databaseName = sanitizeDatabaseLabel(identity.rows[0].database_name);
  if (expectedDb && expectedDb !== databaseName) {
    throw new Error("Database target mismatch: expected " + expectedDb + ", connected to " + databaseName);
  }
  console.log("DATABASE:", databaseName);
  const relation = await client.query("SELECT to_regclass('aca._aca_schema_migrations') IS NOT NULL AS exists");
  const ledgerExists = relation.rows[0].exists === true;
  const publicLedger = await client.query("SELECT to_regclass('public._aca_schema_migrations') IS NOT NULL AS exists");
  if (!ledgerExists && publicLedger.rows[0].exists) {
    throw new Error("Migration ledger exists in public but not aca. Resolve schema drift before applying.");
  }
  const rows = ledgerExists
    ? (await client.query("SELECT version, checksum FROM aca._aca_schema_migrations ORDER BY version")).rows
    : [];
  const plan = await inspectMigrationChain(directory, rows, ledgerExists);
  console.log("LEDGER:", ledgerExists ? "aca._aca_schema_migrations" : "missing");
  console.log("FILES:", plan.total, "APPLIED:", plan.applied.length, "PENDING:", plan.pending.length);
  for (const version of plan.pending) console.log("PENDING", version);
  for (const version of plan.drift) console.error("CHECKSUM_MISMATCH", version);
  for (const version of plan.unknown) console.error("UNKNOWN_APPLIED", version);
  assertMigrationSafe(plan, { verify: mode === "verify", allowFresh: mode === "plan" || (mode === "preflight" && allowFresh) });
  if (mode === "preflight" && !allowFresh && plan.applied.length === 0) {
    throw new Error("No recorded applied migrations. --allow-fresh is required to bootstrap a new database.");
  }
  // --allow-fresh is NOT a recovery switch for an existing database with an
  // absent or empty ledger. Partial DDL may have committed before the runner
  // could record its migration. Require an actually empty user schema.
  // Exclude PostgreSQL internals and extension-owned relations; inspect all
  // user schemas, not just "aca", to avoid accidentally importing an occupied
  // database with unrecorded objects in "public".
  if (mode === "preflight" && allowFresh && plan.applied.length === 0) {
    const existing = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS ns ON ns.oid = relation.relnamespace
        WHERE relation.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
          AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
          AND ns.nspname NOT LIKE 'pg_toast%'
          AND ns.nspname NOT LIKE 'pg_temp_%'
          AND NOT (ns.nspname = 'aca' AND relation.relname = '_aca_schema_migrations')
          AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_depend AS dep
            WHERE dep.classid = 'pg_catalog.pg_class'::regclass
              AND dep.objid = relation.oid AND dep.deptype = 'e'
          )
      ) AS has_user_relations
    `);
    assertFreshDatabaseEmpty(existing.rows[0]?.has_user_relations);
  }

  console.log(mode === "verify" ? "MIGRATION_VERIFICATION: PASS" : mode === "preflight" ? "MIGRATION_PREFLIGHT: PASS" : "MIGRATION_PLAN: PASS");
} catch (error) {
  // Never print a connection string, password, token or PG environment.
  console.error("MIGRATION_CHECK_FAILED:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
