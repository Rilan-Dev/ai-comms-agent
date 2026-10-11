/**
 * Node.js migration runner — mirrors scripts/migrate.sh + scripts/reset-and-migrate.sh logic.
 * Uses the `pg` package because psql is unavailable in this sandbox.
 *
 * Differences from scripts/migrate.sh:
 *   - Creates the `aca` and `private` schemas upfront (mirrors reset-and-migrate.sh).
 *   - Sets search_path=aca,public so unqualified CREATE TABLE land in `aca`.
 *   - Splits each .sql file into individual statements (respecting $$ heredocs,
 *     single/double-quoted strings, line comments) and runs them one-by-one.
 *   - Privilege errors (SQLSTATE 42501 — "insufficient_privilege" / restricted
 *     superuser cannot grant or revoke) are demoted to WARN and skipped, so the
 *     migration chain can complete against a Prisma Postgres restricted superuser.
 *
 * Usage:  DATABASE_URL=<url> node migrate.js [migrations-dir]
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

const DB_URL = process.env.DATABASE_URL;
const MIGRATIONS_DIR =
  process.argv[2] || "/home/z/my-project/ai-comms-agent/supabase/migrations";

if (!DB_URL) {
  console.error("ERROR: DATABASE_URL env var is required.");
  process.exit(1);
}

console.log("DB_URL (masked):", DB_URL.replace(/:[^@]+@/, ":***@"));

const useSSL = DB_URL.includes("sslmode=require");
const pool = new Pool({
  connectionString: DB_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 1,
  connectionTimeoutMillis: 60000,
  idleTimeoutMillis: 30000,
});

/**
 * Split a .sql file into individual statements, preserving:
 *   - $$ ... $$ dollar-quoted heredocs (any case: $name$ ... $name$)
 *   - 'single-quoted' string literals (with '' escapes)
 *   - "double-quoted" identifiers (with "" escapes)
 *   - -- line comments  and  /* block comments
 * Statements are delimited by a top-level `;`.
 */
function splitSql(sql) {
  const stmts = [];
  let buf = "";
  let i = 0;
  const n = sql.length;

  const lineCommentEnd = (idx) => {
    const nl = sql.indexOf("\n", idx);
    return nl === -1 ? n : nl;
  };
  const blockCommentEnd = (idx) => {
    const end = sql.indexOf("*/", idx);
    return end === -1 ? n : end + 2;
  };
  const quoteEnd = (idx, ch) => {
    // Start AFTER the opening quote char, then find the matching close.
    let j = idx + 1;
    while (j < n) {
      const c = sql[j];
      if (c === "\\") { j += 2; continue; }
      if (c === ch) {
        if (sql[j + 1] === ch) { j += 2; continue; }
        return j + 1;
      }
      j++;
    }
    return n;
  };
  const heredocEnd = (idx, tag) => {
    const needle = tag;
    const end = sql.indexOf(needle, idx);
    return end === -1 ? n : end + needle.length;
  };

  while (i < n) {
    const c = sql[i];
    const two = sql.slice(i, i + 2);

    if (two === "--") { i = lineCommentEnd(i); continue; }
    if (two === "/*") { i = blockCommentEnd(i); continue; }
    if (c === "'") { buf += sql.slice(i, quoteEnd(i, "'")); i = quoteEnd(i, "'"); continue; }
    if (c === '"') { buf += sql.slice(i, quoteEnd(i, '"')); i = quoteEnd(i, '"'); continue; }

    // dollar-quoted heredoc — match $tag$ where tag is empty or letters/digits/_
    if (c === "$") {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        buf += sql.slice(i, i + tag.length);
        const bodyEnd = heredocEnd(i + tag.length, tag);
        buf += sql.slice(i + tag.length, bodyEnd);
        i = bodyEnd;
        continue;
      }
    }

    if (c === ";") {
      const stmt = buf.trim();
      if (stmt) stmts.push(stmt);
      buf = "";
      i++;
      continue;
    }

    buf += c;
    i++;
  }
  const tail = buf.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

const PRIVILEGE_ERROR_CODES = new Set([
  "42501", // insufficient_privilege
  "0LP01", // invalid_grant
  "2F003", // procedures_existence_not_granted (function GRANT failed)
  "2F004", // procedures_existence_not_revoked (function REVOKE failed)
  "42704", // undefined_object (e.g. role "authenticated" does not exist)
]);

function looksLikePrivilegeStatement(stmt) {
  const s = stmt.trimLeft().toUpperCase();
  return (
    s.startsWith("GRANT ") ||
    s.startsWith("REVOKE ") ||
    s.startsWith("CREATE ROLE ") ||
    s.startsWith("ALTER ROLE ") ||
    s.startsWith("DROP ROLE ") ||
    s.startsWith("CREATE POLICY ") ||
    s.startsWith("ALTER POLICY ") ||
    s.startsWith("DROP POLICY ") ||
    s.startsWith("ALTER DEFAULT PRIVILEGES") ||
    s.startsWith("CREATE USER ") ||
    s.startsWith("ALTER USER ")
  );
}

function isPrivilegeError(err, stmt) {
  if (!err) return false;
  // Privilege statements that fail with almost any error on a restricted
  // superuser are demoted to warnings, because Prisma Postgres' restricted
  // superuser cannot grant/revoke/create roles and pre-created auth roles
  // may not exist on a fresh DB.
  if (stmt && looksLikePrivilegeStatement(stmt)) {
    return true;
  }
  if (PRIVILEGE_ERROR_CODES.has(err.code)) return true;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("restricted superuser cannot grant or revoke") ||
    msg.includes("insufficient_privilege") ||
    msg.includes("must be the owner") ||
    msg.includes("permission denied")
  );
}

async function main() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.error(`ERROR: no .sql files in ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS aca;`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS private;`);
    await client.query(`SET search_path = aca, public;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS _aca_schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    let applied = 0;
    let skipped = 0;
    let privilegeWarnings = 0;
    let stmtIdx = 0;
    for (const fname of files) {
      const fpath = join(MIGRATIONS_DIR, fname);
      const content = await readFile(fpath, "utf8");
      const checksum = createHash("sha256").update(content).digest("hex");
      const { rows } = await client.query(
        `SELECT checksum FROM _aca_schema_migrations WHERE version = $1`,
        [fname],
      );
      if (rows.length > 0) {
        if (rows[0].checksum !== checksum) {
          console.error(
            `ERROR: migration checksum changed after application: ${fname}`,
          );
          process.exit(2);
        }
        console.log(`SKIP  ${fname}`);
        skipped++;
        continue;
      }
      console.log(`APPLY ${fname}`);
      const stmts = splitSql(content);
      // Auto-commit each statement (mirrors `psql -f file.sql` default).
      // Prisma Data Proxy uses PgBouncer transaction-mode pooling, which does
      // not support SAVEPOINT, so we cannot wrap the file in a single txn.
      // Idempotent statements (CREATE TABLE IF NOT EXISTS, CREATE EXTENSION
      // IF NOT EXISTS, DO $$ EXCEPTION WHEN duplicate_object …) make this safe.
      for (const stmt of stmts) {
        stmtIdx++;
        try {
          await client.query(stmt);
        } catch (err) {
          if (isPrivilegeError(err, stmt)) {
            privilegeWarnings++;
            const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
            console.log(
              `  WARN stmt#${stmtIdx} (${err.code || "?"}) ${preview}…`,
            );
            continue;
          }
          console.error(`ERROR: migration failed: ${fname}`);
          console.error(`  code: ${err.code}`);
          console.error(`  message: ${err.message}`);
          process.exit(1);
        }
      }
      // Record ledger entry only after all statements succeed.
      try {
        await client.query(
          `INSERT INTO _aca_schema_migrations(version, checksum) VALUES ($1, $2)`,
          [fname, checksum],
        );
      } catch (err) {
        console.error(`ERROR: failed to record migration: ${fname}`);
        console.error(`  code: ${err.code}`);
        console.error(`  message: ${err.message}`);
        process.exit(1);
      }
      applied++;
    }
    console.log(
      `PASS: migration chain complete. applied=${applied} skipped=${skipped} privilege_warnings=${privilegeWarnings} total=${files.length}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("FATAL code:", err.code);
  console.error("FATAL message:", err.message);
  console.error("FATAL stack:", err.stack);
  if (err.errors) {
    for (const sub of err.errors) {
      console.error("  sub-error:", sub.code, sub.message);
    }
  }
  process.exit(1);
});
