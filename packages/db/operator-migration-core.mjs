// Pure, non-mutating migration manifest checks. No database credentials.
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export async function inspectMigrationChain(directory, ledgerRows = [], ledgerExists = true) {
  const files = (await readdir(directory)).filter((name) => /^[A-Za-z0-9][A-Za-z0-9_.-]*\.sql$/.test(name)).sort();
  if (files.length === 0) throw new Error("No SQL migration files found.");
  const known = new Map();
  for (const version of files) {
    const content = await readFile(join(directory, version));
    known.set(version, createHash("sha256").update(content).digest("hex"));
  }
  const ledger = new Map();
  for (const row of ledgerRows) {
    if (ledger.has(row.version)) throw new Error("Duplicate migration ledger version: " + row.version);
    ledger.set(row.version, row.checksum);
  }
  const applied = [];
  const pending = [];
  const drift = [];
  for (const [version, checksum] of known) {
    const stored = ledger.get(version);
    if (stored === undefined) pending.push(version);
    else if (stored !== checksum) drift.push(version);
    else applied.push(version);
  }
  const unknown = [...ledger.keys()].filter((version) => !known.has(version)).sort();
  return { ledgerExists, total: files.length, applied, pending, drift, unknown };
}

export function assertMigrationSafe(plan, { verify = false, allowFresh = false } = {}) {
  if (plan.drift.length) throw new Error("Applied migration checksum changed: " + plan.drift.join(", "));
  if (plan.unknown.length) throw new Error("Database has migrations missing from checkout: " + plan.unknown.join(", "));
  if (!verify && !allowFresh && !plan.ledgerExists) {
    throw new Error("No aca migration ledger exists. Use --allow-fresh only after confirming this is a new, backed-up database.");
  }
  if (verify && (!plan.ledgerExists || plan.pending.length)) {
    throw new Error("Migration verification incomplete: ledger missing or " + plan.pending.length + " pending file(s).");
  }
}

export function sanitizeDatabaseLabel(value) {
  // Only database NAMES are printed, never a connection string or username.
  if (typeof value !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(value)) {
    throw new Error("Expected database name must be a plain PostgreSQL database identifier.");
  }
  return value;
}
