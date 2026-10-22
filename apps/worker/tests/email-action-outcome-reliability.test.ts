import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../src/email/action-worker.ts", import.meta.url), "utf8");
const repo = readFileSync(new URL("../../../packages/db/src/email/actions.ts", import.meta.url), "utf8");

test("approved action starts its own execution clock rather than reusing request time", () => {
  const claim = repo.slice(repo.indexOf("export async function claimApprovedEmailAction"),
    repo.indexOf("export async function completeEmailAction"));
  const recovery = repo.slice(repo.indexOf("export async function recoverStaleExecutingEmailActions"));
  assert.match(claim, /'execution_started_at'/);
  assert.match(claim, /jsonb_build_object/);
  assert.match(claim, /WHERE id = \$1/);
  assert.match(claim, /AND status = 'approved'/);
  assert.match(recovery, /result->>'execution_started_at'/);
  assert.match(recovery, /approved_at/);
  assert.match(recovery, /requested_at/);
  assert.match(recovery, /WHERE status = 'executing'/);
  assert.match(recovery, /providerOutcomeUnknown/);
});

test("a successful provider execution is durably completed before draft reconciliation and evidence side effects", () => {
  const completion = worker.indexOf('await completeEmailAction(action.id, action.organizationId, "completed"');
  const markDraft = worker.indexOf("markLocalDraftSentForOrganization(action.organizationId");
  const event = worker.indexOf('type: "email.action.completed"');
  const audit = worker.indexOf('eventType: "email.action.completed"');
  assert.ok(completion >= 0 && markDraft > completion && event > completion && audit > completion);
  assert.match(worker, /if \(!completed\)/);
  assert.match(worker, /bestEffortEmailOutcome/);
  assert.match(worker, /providerResult/);
  assert.match(worker, /Provider delivery succeeded; durable completion could not be recorded/);
});

test("event or audit failure does not misclassify a completed external send as failed", () => {
  assert.match(worker, /async function bestEffortEmailOutcome/);
  assert.match(worker, /catch \(error\)/);
  const success = worker.slice(worker.indexOf('await completeEmailAction(action.id, action.organizationId, "completed"'));
  assert.match(success, /await bestEffortEmailOutcome/);
  assert.match(success, /type: "email.action.completed"/);
  assert.match(success, /eventType: "email.action.completed"/);
  assert.doesNotMatch(success, /await completeEmailAction\(action.id, action.organizationId, "failed"[^\n]*\n\s*await emitProviderEvent/);
});

test("failed event is emitted only when the executing action actually transitioned to failed", () => {
  assert.match(worker, /settled = await completeEmailAction\(action.id, action.organizationId, "failed"/);
  assert.match(worker, /if \(!settled\)/);
  assert.match(worker, /type: "email.action.failed"/);
  assert.match(worker, /eventType: "email.action.failed"/);
  assert.match(worker, /manualVerificationRequired/);
});

test("stale recovery auditing is fail-isolated from processing newly approved actions", () => {
  assert.match(worker, /const recovered = await recoverStaleExecutingEmailActions\(\)/);
  assert.match(worker, /bestEffortEmailOutcome\("recovered"/);
  const recovery = worker.indexOf("const recovered = await recoverStaleExecutingEmailActions()");
  const claims = worker.indexOf("const actions = await listApprovedEmailActions(limit)");
  assert.ok(recovery >= 0 && claims > recovery);
});
