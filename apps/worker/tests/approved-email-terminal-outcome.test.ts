import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const executor = readFileSync(new URL("../src/email/action-executor.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/email/action-worker.ts", import.meta.url), "utf8");

test("provider delivery is terminal before a local-draft reconciliation attempt", () => {
  const completed = executor.indexOf('completeEmailAction(claimed.id, organizationId, "completed"');
  const mark = executor.indexOf("await markLocalDraftSentForOrganization(");
  assert.ok(completed >= 0, "the provider success must be durably recorded");
  assert.ok(mark > completed, "local draft sync must only follow a confirmed durable success");
  assert.match(executor, /if \(!completed\)/);
});

test("a local sync or completion-storage error after provider delivery never rewrites the action as failed", () => {
  assert.match(executor, /let providerAccepted = false;/);
  assert.match(executor, /providerAccepted = true;/);
  assert.match(executor, /if \(providerAccepted \|\| providerDispatchStarted\) \{/);
  assert.match(executor, /manualVerificationRequired: true/);
  assert.match(executor, /catch \(reconcileError\)/);
  assert.match(executor, /await completeEmailAction\(claimed.id, organizationId, "failed"/);
  assert.ok(
    executor.indexOf("if (providerAccepted || providerDispatchStarted)") <
      executor.lastIndexOf('await completeEmailAction(claimed.id, organizationId, "failed"'),
    "success must bypass the failure settlement",
  );
});

test("standard batch worker already settles the provider outcome before any optional local sync", () => {
  assert.ok(worker.indexOf('completeEmailAction(action.id, action.organizationId, "completed"') <
    worker.indexOf('bestEffortEmailOutcome("draft_reconcile"'));
  assert.match(worker, /manualVerificationRequired: true/);
});

test("approved sends still require provider verification and a separately claimed approval", () => {
  assert.match(executor, /claimApprovedEmailAction\(actionId, organizationId\)/);
  assert.match(executor, /verifyEmailProviderConnection\(/);
  assert.doesNotMatch(executor, /decideEmailAction\(/);
});

test("batch worker does not mark a successfully accepted provider send failed if disconnect rejects", () => {
  const catchBlock = worker.slice(worker.indexOf("} catch (error) {", worker.indexOf("export async function processApprovedEmailActions")),
    worker.indexOf('bestEffortEmailOutcome("failed_event"'));
  assert.match(worker, /let providerAccepted = false;/);
  assert.match(worker, /providerAccepted = true;/);
  assert.match(catchBlock, /if \(providerAccepted \|\| providerDispatchStarted\) \{/);
  assert.match(catchBlock, /manualVerificationRequired: true/);
  assert.match(catchBlock, /continue;/);
  const failureSettlement = catchBlock.indexOf('completeEmailAction(action.id, action.organizationId, "failed"');
  assert.ok(failureSettlement > catchBlock.indexOf("if (providerAccepted || providerDispatchStarted)"),
    "once the provider accepts an action it must bypass the failure settlement");
  for (const invoke of ["connected.sendDraft(providerDraftId)", "connected.reply(", "connected.sendDraft(forwardDraftId)"]) {
    const pos = worker.indexOf(invoke);
    const nextReturn = worker.indexOf("return { kind:", pos);
    const ack = worker.indexOf("providerAccepted = true;", pos);
    assert.ok(pos >= 0 && nextReturn > pos && ack > pos && ack < nextReturn,
      invoke + " must record provider acceptance before any disconnect can fail");
  }
});
