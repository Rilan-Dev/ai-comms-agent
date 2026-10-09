import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detail = readFileSync(resolve(process.cwd(), "src/app/agents/[id]/agent-detail-client.tsx"), "utf8");
const page = readFileSync(resolve(process.cwd(), "src/app/agents/[id]/page.tsx"), "utf8");

test("agent detail keeps organization-scoped server loading and not-found state", () => {
  assert.match(page, /getAuthenticatedAppContext/);
  assert.match(page, /repo\.get\(organizationId, id\)/);
  assert.match(page, /Agent not found/);
});

test("agent detail exposes accessible horizontal sections and a valid activity icon", () => {
  assert.match(detail, /aria-label="Agent sections"/);
  assert.match(detail, /aria-pressed=\{tab===item\}/);
  assert.match(detail, /<ActivityIcon size=\{16\}/);
  assert.doesNotMatch(detail, /<Activity size=\{16\}/);
});

test("agent detail preserves version, policy, channel, simulation and explicit deployment safeguards", () => {
  for (const path of ["/versions", "/policy", "/channels", "/simulate", "/deploy"]) {
    assert.ok(detail.includes(path), `expected existing agent action endpoint ${path}`);
  }
  assert.match(detail, /setShowConfirm\("deploy"\)/);
  assert.match(detail, /setShowConfirm\("retire"\)/);
  assert.match(detail, /Version configuration must be valid JSON/);
});
