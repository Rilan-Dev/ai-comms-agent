import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/messaging/whatsapp-inbound-worker.ts", import.meta.url), "utf8",
);

test("inbound execution completes before its audit and does not duplicate event automation", () => {
  const settled = source.indexOf('await completeWhatsAppInbound(messageId, "completed");');
  const counted = source.indexOf("completed += 1;", settled);
  const audited = source.indexOf('eventType: "whatsapp.inbound.agent_executed"', settled);
  assert.ok(settled >= 0 && counted > settled && audited > counted);
  assert.doesNotMatch(source, /evaluateAutomationEvent\(/);
});

test("separate durable WhatsApp event outbox retains failures independently of inbound completion", () => {
  const outbox = readFileSync(new URL("../src/automation/event-outbox-worker.ts", import.meta.url), "utf8");
  assert.match(outbox, /m\.direction='inbound'/);
  assert.match(outbox, /m\.provider_message_id IS NOT NULL/);
  assert.match(outbox, /ON CONFLICT\(organization_id,event_type,source_key\) DO NOTHING/);
  assert.match(outbox, /await evaluateAutomationEvent\(\{organizationId:/);
  assert.match(outbox, /status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END/);
  assert.match(source, /catch \{\s*\/\/ Execution has already completed\. An audit outage does not replay it\./);
});

test("successful-execution audit failures cannot reclassify durable inbound completion", () => {
  assert.match(source, /try\s*\{\s*await recordAuditEvent\(\{\s*organizationId,\s*actorUserId: null,\s*eventType: "whatsapp\.inbound\.agent_executed"/);
  assert.match(source, /catch \{\s*\/\/ Execution has already completed\. An audit outage does not replay it\./);
  assert.match(source, /await completeWhatsAppInbound\(messageId, "failed", reason\)/);
});
