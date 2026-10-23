import assert from "node:assert/strict";
import {test} from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detail = readFileSync(resolve(__dirname, "../src/app/agents/[id]/agent-detail-client.tsx"), "utf8");
const page = readFileSync(resolve(__dirname, "../src/app/agents/[id]/page.tsx"), "utf8");

test("agent detail keeps organization-scoped server loading and not-found state", () => {
  assert.match(page, /getAuthenticatedAppContext/);
  assert.match(page, /repo\.get\(organizationId,\s*id\)/);
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

const automationsPage = readFileSync(resolve(__dirname, "../src/app/automations/page.tsx"), "utf8");
const schedulesPage = readFileSync(resolve(__dirname, "../src/app/schedules/page.tsx"), "utf8");

test("automation and schedule pages use the authenticated organization context", () => {
  for (const source of [automationsPage, schedulesPage]) {
    assert.match(source, /getAuthenticatedAppContext/);
    assert.match(source, /context\.organizationId/);
    assert.match(source, /not_provisioned/);
    assert.doesNotMatch(source, /ensureDevSeed|getDevOrgId/);
  }
});
