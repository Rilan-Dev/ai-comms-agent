import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const projects = [
  "apps/web", "apps/worker", "packages/shared", "packages/db",
  "packages/clara-core", "packages/email-agent-runtime",
];

test("root workspace clean explicitly runs package scripts, not pnpm's built-in clean", () => {
  // pnpm v11/v12 reserves `clean` as a built-in command. A short-form
  // `pnpm -r clean` is parsed as an unsupported recursive option by it.
  assert.match(manifest.scripts.clean, /^pnpm -r run clean && rm -rf node_modules$/);
  assert.doesNotMatch(manifest.scripts.clean, /\bpnpm\s+(?:-r|--recursive)\s+clean\b/);
});

test("all six workspace targets have a local clean script (no root recursion)", () => {
  for (const project of projects) {
    const pkg = JSON.parse(readFileSync(new URL(`../../${project}/package.json`, import.meta.url), "utf8"));
    assert.equal(typeof pkg.scripts?.clean, "string", project);
    assert.doesNotMatch(pkg.scripts.clean, /\bpnpm\s+(?:-r|--recursive)\s+(?:run\s+)?clean\b/, project);
  }
});

test("normal build/test/typecheck recursion remains separate from cleanup", () => {
  for (const name of ["build", "lint", "test", "typecheck"]) {
    assert.match(manifest.scripts[name], /^pnpm -r /, name);
  }
  assert.equal(manifest.packageManager, "pnpm@12.8.1");
});
