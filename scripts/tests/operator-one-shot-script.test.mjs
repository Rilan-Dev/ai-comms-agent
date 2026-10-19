import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const path = resolve(root, "scripts/operator-one-shot.sh");
const script = readFileSync(path, "utf8");

test("one-shot operator script is valid Bash", () => {
  const result = spawnSync("bash", ["-n", path], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("noninteractive execution stops before Docker, DB writes, or deployment", () => {
  const result = spawnSync("bash", [path], { encoding: "utf8", input: "" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /interactive terminal is required/);
});

test("source and test verification happens before live database migration", () => {
  const tests = script.indexOf("node --test scripts/tests/operator-migration-core.test.mjs");
  const typechecks = script.indexOf("pnpm -r typecheck");
  const plan = script.indexOf("bash scripts/operator-migrate.sh plan --expect-db");
  const apply = script.indexOf("bash scripts/operator-migrate.sh apply --expect-db");
  const verify = script.indexOf("bash scripts/operator-migrate.sh verify --expect-db");
  const deploy = script.indexOf("vercel deploy --prod --yes");
  assert.ok(tests >= 0 && tests < typechecks && typechecks < plan && plan < apply && apply < verify && verify < deploy);
  assert.match(script, /git pull --ff-only origin main/);
});

test("preflight requires trusted branch, clean tree, selected Compose and DB identity", () => {
  assert.match(script, /git branch --show-current/);
  assert.match(script, /git status --porcelain/);
  assert.match(script, /ACA_EXPECT_DB/);
  assert.match(script, /--expect-db "\$database"/);
  assert.match(script, /ACA_COMPOSE_FILE/);
  assert.match(script, /--env-file "\$ROOT\/\.env"/);
});

test("cannot silently apply SQL or bypass a restorable backup acknowledgement", () => {
  assert.match(script, /ACA_BACKUP_REFERENCE/);
  assert.match(script, /backup_ref/);
  assert.match(script, /Type APPLY \$database/);
  assert.match(script, /"APPLY \$database"/);
  assert.match(script, /--backup-confirmed/);
  assert.doesNotMatch(script, /--allow-fresh|reset-and-migrate\.sh|DROP SCHEMA/);
});

test("bundled development Compose cannot be used to release production Docker services", () => {
  assert.match(script, /PRODUCTION_FILE.*!=.*docker-compose\.yml/);
  assert.match(script, /ACA_ENABLE_DEV_IDENTITY/);
  assert.match(script, /up -d --no-deps --no-build/);
  assert.match(script, /ACA_PRODUCTION_COMPOSE_FILE/);
  assert.doesNotMatch(script, /ACA_RELEASE_TARGET:-docker/);
});

test("automated tests never inherit production Compose credentials or network access", () => {
  assert.match(script, /docker build --target web --tag "\$WEB_IMAGE" "\$ROOT"/);
  assert.match(script, /docker run --rm --network none/);
  assert.match(script, /pnpm -r typecheck; pnpm -r test; pnpm --filter @ai-comms-agent\/worker build/);
  assert.doesNotMatch(script, /web sh -euc 'pnpm -r typecheck/);
  assert.match(script, /Run automated test suites inside the production Compose service/i.test(script)
    ? /NEVER run automated test suites inside the production Compose service/
    : /NO production environment and NO network access/);
});

test("Vercel must be linked and authenticated; health does not claim integration acceptance", () => {
  assert.match(script, /\.vercel\/project\.json/);
  assert.match(script, /vercel whoami/);
  assert.match(script, /vercel deploy --prod --yes/);
  assert.match(script, /not proof of provider or tenant E2E readiness/);
});
