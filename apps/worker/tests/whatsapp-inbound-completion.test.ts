import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/messaging/whatsapp-inbound-worker.ts", import.meta.url), "utf8",
);

test("inbound execution completes before optional automation side effects", () => {
  const settled = source.indexOf('await completeWhatsAppInbound(messageId, "completed");');
  const counted = source.indexOf("completed += 1;", settled);
  const downstream = source.indexOf("await evaluateAutomationEvent({", settled);
  assert.ok(settled >= 0 && counted > settled && downstream > counted);
});

test("automation failures are caught and separately recorded, not converted to inbound failures", () => {
  assert.match(source, /try\s*\{\s*await evaluateAutomationEvent\(\{/);
  assert.match(source, /catch \(automationError\) \{/);
  assert.match(source, /eventType: "automation\.provider_event_delivery_failed"/);
  assert.match(source, /inboundExecutionCompleted: true/);
  assert.match(source, /catch \{\s*\/\/ Do not turn successful inbound execution into a false failure\./);
});

test("successful-execution audit failures cannot reclassify durable inbound completion", () => {
  assert.match(source, /try\s*\{\s*await recordAuditEvent\(\{\s*organizationId,\s*actorUserId: null,\s*eventType: "whatsapp\.inbound\.agent_executed"/);
  assert.match(source, /catch \{\s*\/\/ Execution has already completed\. An audit outage does not replay it\./);
  assert.match(source, /await completeWhatsAppInbound\(messageId, "failed", reason\)/);
});
