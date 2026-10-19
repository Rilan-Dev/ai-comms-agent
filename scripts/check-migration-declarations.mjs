/**
 * Static safety check for genuinely unsafe duplicate DDL.
 *
 * Historical and reconciliation SQL files intentionally repeat
 * CREATE TABLE IF NOT EXISTS and exception-guarded CREATE TYPE in DO blocks.
 * Neither is a duplicate *unsafe* declaration. Filename/SHA integrity and
 * database state are separately enforced by operator-migration-check.mjs.
 *
 * This source check rejects repeated unguarded CREATE TABLE / CREATE TYPE
 * declarations while respecting the app's default SQL search_path=aca,public.
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const objectName = '(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_]*)';
const createTable = new RegExp(
  `^[ \\t]*CREATE[ \\t]+TABLE[ \\t]+(IF[ \\t]+NOT[ \\t]+EXISTS[ \\t]+)?(${objectName}(?:\\.${objectName})?)`,
  "gim",
);
const createEnum = new RegExp(
  `^[ \\t]*CREATE[ \\t]+TYPE[ \\t]+(IF[ \\t]+NOT[ \\t]+EXISTS[ \\t]+)?(${objectName}(?:\\.${objectName})?)[ \\t]+AS[ \\t]+ENUM\\b`,
  "gim",
);

function blank(segment) {
  return segment.replace(/[^\n]/g, " ");
}

/** Exclude comments, string contents, and procedural DO / function bodies. */
function executableSql(sql) {
  return sql
    .replace(/(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)[\s\S]*?\1/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/'(?:''|[^'])*'/g, blank)
    .replace(/--[^\n]*/g, blank);
}

function canonicalName(raw) {
  const parts = raw.match(/"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const normalized = parts.map((part) => part.startsWith('"')
    ? part.slice(1, -1).replace(/""/g, '"')
    : part.toLowerCase());
  return (normalized.length === 1 ? ["aca", normalized[0]] : normalized).join(".");
}

/**
 * Return errors for repeated *unconditional* declarations only.
 * Idempotent declarations, safely guarded historical type definitions,
 * and the same object name in different SQL schemas are legal.
 */
export function findUnsafeMigrationDeclarations(migrations) {
  const seen = new Map();
  const errors = [];
  for (const { version, sql } of migrations) {
    const code = executableSql(sql);
    for (const [kind, pattern] of [["table", createTable], ["enum", createEnum]]) {
      pattern.lastIndex = 0;
      for (const match of code.matchAll(pattern)) {
        if (match[1]) continue; // IF NOT EXISTS: intentionally idempotent.
        const name = canonicalName(match[2]);
        const key = `${kind}:${name}`;
        const previous = seen.get(key);
        if (previous) {
          errors.push(`Repeated non-idempotent ${kind} definition ${name}: ${previous} and ${version}`);
        } else {
          seen.set(key, version);
        }
      }
    }
  }
  return errors;
}

export async function inspectUnsafeMigrationDeclarations(directory) {
  const files = (await readdir(directory))
    .filter((name) => /^[A-Za-z0-9][A-Za-z0-9_.-]*\.sql$/.test(name))
    .sort();
  const migrations = await Promise.all(
    files.map(async (version) => ({ version, sql: await readFile(join(directory, version), "utf8") })),
  );
  return findUnsafeMigrationDeclarations(migrations);
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  const directory = resolve(process.argv[2] || "supabase/migrations");
  try {
    const errors = await inspectUnsafeMigrationDeclarations(directory);
    if (errors.length) {
      for (const error of errors) console.error("ERROR:", error);
      process.exitCode = 1;
    } else {
      console.log("Migration declaration safety: PASS (historical IF NOT EXISTS and guarded enum reassertions allowed)");
    }
  } catch (error) {
    console.error("ERROR: could not inspect migration declarations:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  }
}
