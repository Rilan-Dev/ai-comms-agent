import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(root, "scripts/start-briefing-testdb.sh");
const script = readFileSync(scriptPath, "utf8");
const fixture = readFileSync(resolve(root, "packages/db/tests/helpers/briefing-db-fixture.mjs"), "utf8");

test("disposable PostgreSQL bootstrap parses as valid Bash", () => {
  const result = spawnSync("bash", ["-n", scriptPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("missing opt-in rejects immediately without running Docker", () => {
  const env = { ...process.env };
  delete env.BRIEFING_TEST_DATABASE_OPT_IN;
  delete env.BRIEFING_TEST_DATABASE_URL;
  const result = spawnSync("bash", [scriptPath], { env, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Explicit opt-in required/);
});

test("non-disposable URL is rejected before any Docker operation", () => {
  const result = spawnSync("bash", [scriptPath], {
    env: {
      ...process.env,
      BRIEFING_TEST_DATABASE_OPT_IN: "disposable-local-c1",
      BRIEFING_TEST_DATABASE_URL: "postgresql://postgres@127.0.0.1:5432/postgres",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing non-test/);
});

test("provisioner cannot expose test DB externally or bind persistent data", () => {
  assert.match(script, /--publish 127\.0\.0\.1:55432:5432/);
  assert.match(script, /--tmpfs \/var\/lib\/postgresql\/data/);
  assert.match(script, /POSTGRES_DB=ai_comms_c1_test/);
  assert.match(script, /POSTGRES_HOST_AUTH_METHOD=trust/);
  assert.match(script, /ai-comms-c1-testdb/);
  assert.match(script, /inspect_safe \|\| die/);
  assert.doesNotMatch(script, /--volume\s/);
  assert.doesNotMatch(script, /--publish 0\.0\.0\.0/);
  assert.doesNotMatch(script, /docker (rm|stop|compose down)/);
  assert.doesNotMatch(script, /DROP SCHEMA|DROP DATABASE/);
});

test("fixture fails closed and gives actionable missing-container guidance", () => {
  assert.match(fixture, /BRIEFING_TEST_DATABASE_OPT_IN.*disposable-local-c1/);
  assert.match(fixture, /scripts\/start-briefing-testdb\.sh/);
  assert.match(fixture, /Refusing unsafe briefing test container/);
  assert.doesNotMatch(fixture, /process\.env\.DATABASE_URL\s*\?\?/);
});
