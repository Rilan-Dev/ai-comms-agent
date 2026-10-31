import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/0053_whatsapp_check_constraints.sql", import.meta.url);
const postgresProbePath = new URL("./whatsapp-check-constraints.postgres.sql", import.meta.url);
const installedProbePath = new URL("./whatsapp-check-constraints-installed.postgres.sql", import.meta.url);
const authorizationPath = new URL("../../apps/web/src/lib/identity/authorization.ts", import.meta.url);
const dbClientPath = new URL("../../packages/db/src/client.ts", import.meta.url);

test("forward migration replaces the exact two legacy CHECK constraints without weakening validation", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /ALTER TABLE whatsapp_send_actions/);
  assert.match(sql, /DROP CONSTRAINT whatsapp_send_actions_recipient_phone_check/);
  assert.ok(sql.includes("CHECK (recipient_phone ~ '^[+][1-9][0-9]{7,14}$')"));
  assert.match(sql, /ALTER TABLE whatsapp_templates/);
  assert.match(sql, /DROP CONSTRAINT whatsapp_templates_name_check/);
  assert.ok(sql.includes("char_length(name) BETWEEN 1 AND 512"));
  assert.ok(sql.includes("name ~ '^[a-z0-9_]+$'"));
  assert.doesNotMatch(sql, /\{1,512\}/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM|DISABLE TRIGGER/i);
});

test("PostgreSQL integration probe exercises valid and invalid data and rolls back", () => {
  const probe = readFileSync(postgresProbePath, "utf8");
  assert.ok(probe.includes("SET LOCAL standard_conforming_strings = on;"));
  assert.ok(probe.includes("\\ir ../../supabase/migrations/0053_whatsapp_check_constraints.sql"));
  assert.ok(probe.includes("SQLSTATE '23514'"));
  assert.ok(probe.includes("ROLLBACK;"));
  assert.ok(probe.includes("repeat('a', 512)"));
  assert.ok(probe.includes("repeat('a', 513)"));
});

test("unexpected PostgreSQL errors do not print failing-row details or request values", () => {
  const auth = readFileSync(authorizationPath, "utf8");
  assert.ok(auth.includes('[authorization] unexpected error'));
  assert.doesNotMatch(auth, /console\.error\("\[authorization\] unexpected error:", error\)/);
  assert.ok(auth.includes('internal_server_error'));
});


test("shared PostgreSQL query/pool errors log SQLSTATE only, never failing rows or SQL text", () => {
  const source = readFileSync(dbClientPath, "utf8");
  assert.match(source, /export function safePostgresDiagnostic\(/);
  assert.match(source, /\^\[A-Z0-9\]\{5\}\$/);
  assert.ok(source.includes('console.error("[db] PostgreSQL pool error", safePostgresDiagnostic(error));'));
  assert.ok(source.includes('console.error("[db] PostgreSQL query failed", safePostgresDiagnostic(error));'));
  assert.doesNotMatch(source, /console\.error\("\[db\] PostgreSQL pool error", error\)/);
  assert.doesNotMatch(source, /console\.error\(JSON\.stringify\(\{/);
  assert.doesNotMatch(source, /sql:\s*text/);
  assert.doesNotMatch(source, /postgresError\.message/);
});

test("OPS post-deploy constraint verification is read-only and checks both installed aca definitions", () => {
  const probe = readFileSync(installedProbePath, "utf8");
  assert.match(probe, /BEGIN READ ONLY;/);
  assert.match(probe, /to_regclass\('aca\.whatsapp_send_actions'\)/);
  assert.match(probe, /to_regclass\('aca\.whatsapp_templates'\)/);
  assert.match(probe, /pg_get_constraintdef\(c\.oid\)/);
  assert.match(probe, /c\.convalidated/);
  assert.ok(probe.includes("phone_validated IS DISTINCT FROM TRUE"));
  assert.ok(probe.includes("template_validated IS DISTINCT FROM TRUE"));
  assert.ok(probe.includes("whatsapp_send_actions_recipient_phone_check"));
  assert.ok(probe.includes("whatsapp_templates_name_check"));
  assert.match(probe, /ROLLBACK;/);
  assert.doesNotMatch(probe, /^\s*(?:INSERT|UPDATE|DELETE|ALTER TABLE|TRUNCATE)\b/im);
});
