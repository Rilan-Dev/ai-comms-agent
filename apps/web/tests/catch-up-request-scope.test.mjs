import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { CatchUpRequestScope } from "../src/app/catch-up/request-scope.ts";

test("agent change invalidates a pending response and allows a new scoped operation", () => {
  const scope = new CatchUpRequestScope("agent-A");
  const oldRequest = scope.begin("agent-A");
  assert.ok(oldRequest);
  assert.equal(scope.begin("agent-A"), null);
  scope.switchAgent("agent-B");
  assert.equal(scope.isCurrent(oldRequest), false);
  const current = scope.begin("agent-B");
  assert.ok(current);
  assert.equal(scope.finish(oldRequest), false);
  assert.equal(scope.isCurrent(current), true);
  assert.equal(scope.finish(current), true);
});

test("agent identity alone is insufficient after switching away and back", () => {
  const scope = new CatchUpRequestScope("agent-A");
  const oldRequest = scope.begin("agent-A");
  assert.ok(oldRequest);
  scope.switchAgent("agent-B");
  scope.switchAgent("agent-A");
  assert.equal(scope.isCurrent(oldRequest), false);
  assert.equal(scope.finish(oldRequest), false);
  const next = scope.begin("agent-A");
  assert.ok(next);
  assert.notEqual(next.version, oldRequest.version);
  assert.equal(scope.finish(next), true);
});

test("double-click and stale completion cannot release a newer request lock", () => {
  const scope = new CatchUpRequestScope("agent-A");
  const first = scope.begin("agent-A");
  assert.ok(first);
  assert.equal(scope.begin("agent-A"), null);
  scope.switchAgent("agent-B");
  const second = scope.begin("agent-B");
  assert.ok(second);
  assert.equal(scope.finish(first), false);
  assert.equal(scope.begin("agent-B"), null);
  assert.equal(scope.finish(second), true);
  assert.ok(scope.begin("agent-B"));
});

test("unknown agent and harmless same-agent selection cannot reset a pending request", () => {
  const scope = new CatchUpRequestScope("agent-A");
  assert.equal(scope.begin("agent-Z"), null);
  const token = scope.begin("agent-A");
  assert.ok(token);
  scope.switchAgent("agent-A");
  assert.equal(scope.isCurrent(token), true);
  assert.equal(scope.finish(token), true);
});

test("UI fences every async source, summary and review path before state mutation", () => {
  const source = readFileSync(new URL("../src/app/catch-up/catch-up-client.tsx", import.meta.url), "utf8");
  assert.match(source, /new CatchUpRequestScope\(agents\[0\]\?\.agentId \?\? ""\)/);
  assert.match(source, /function changeAgent\(nextAgentId: string\)/);
  assert.match(source, /requestScopeRef\.current\.switchAgent\(nextAgentId\)/);
  assert.match(source, /function runScopedOperation\(/);
  assert.match(source, /requestScopeRef\.current\.begin\(agentId\)/);
  assert.match(source, /requestScopeRef\.current\.finish\(token\)/);
  assert.match(source, /async function loadDetail\(id: string, token: CatchUpScopeToken\)/);
  assert.match(source, /async function loadSources\(id: string, token: CatchUpScopeToken/);
  assert.match(source, /if \(!requestScopeRef\.current\.isCurrent\(token\)\) return/);
  assert.match(source, /agentId: token\.agentId/);
  assert.match(source, /onChange=\{e => changeAgent\(e\.target\.value\)\}/);
  assert.match(source, /<input type="checkbox" checked=\{mailboxIds\.includes\(m\.id\)\}[\s\S]{0,60}disabled=\{busy\}/);
  assert.match(source, /<select value=\{days\} disabled=\{busy\}/);
  assert.match(source, /function changeMailbox\(mailboxId: string, checked: boolean\)/);
  assert.match(source, /function changeDays\(nextDays: number\)/);
  assert.match(source, /onChange=\{e => changeMailbox\(m\.id, e\.target\.checked\)\}/);
  assert.match(source, /onChange=\{e => changeDays\(Number\(e\.target\.value\)\)\}/);
  const edits = source.slice(source.indexOf("function changeMailbox("), source.indexOf("// All four read/write UI operations"));
  assert.equal((edits.match(/clearSelectionResults\(\)/g) ?? []).length, 2);
  assert.match(source, /function clearSelectionResults\(\)/);
  assert.doesNotMatch(source, /setAgentId\(e\.target\.value\)/);
});
