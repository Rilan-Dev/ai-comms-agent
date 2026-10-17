import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../manual-up.sh", import.meta.url), "utf8");

test("manual deployment supports Compose versions without config --environment", () => {
  assert.match(script, /config --environment 2>\/dev\/null/);
  assert.match(script, /reading DATABASE_URL from the same host\/\.env interpolation sources/);
  assert.match(script, /migration_db_url="\$\{DATABASE_URL:-\}"/);
});

test("manual deployment fails closed when DATABASE_URL is unresolved or missing", () => {
  assert.match(script, /migration_db_url" == \*'\$\{'/);
  assert.match(script, /DATABASE_URL is missing from the Compose environment/);
  assert.match(script, /DATABASE_URL contains unresolved Compose interpolation/);
});

test("manual deployment does not print the resolved database URL", () => {
  assert.doesNotMatch(script, /echo ["'].*\$migration_db_url/);
});

test("manual Compose services use the repository-root env file", async () => {
  const compose = await readFile(new URL("../../docker-compose.manual.yml", import.meta.url), "utf8");
  assert.equal(compose.split("      - .env").length - 1, 2);
  assert.equal(compose.includes("../.env"), false);
});
