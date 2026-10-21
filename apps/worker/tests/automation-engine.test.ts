import test from "node:test";
import assert from "node:assert/strict";
import { automationMatches, evaluateAutomationEvent, stableEventKey } from "../src/automation/automation-engine";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const rule = (trigger: Record<string, unknown>, conditions: Record<string, unknown> = {}) =>
  ({ organizationId: orgA, trigger, conditions });
const event = (type: string, payload: Record<string, unknown> = {}, organizationId = orgA) =>
  ({ organizationId, type, payload });

test("matches trigger type and payload subset within the trusted organization", () => {
  assert.equal(automationMatches(rule(
    { type: "email.received", match: { from: "boss@example.com" } },
  ), event("email.received", { from: "boss@example.com", subject: "Hello" })), true);
});

test("rejects unrelated event types and failed conditions", () => {
  assert.equal(automationMatches(rule({ type: "email.received" }), event("whatsapp.received")), false);
  assert.equal(automationMatches(rule(
    { type: "email.received" }, { label: "urgent" },
  ), event("email.received", { label: "normal" })), false);
});

test("UI event trigger key matches, but conflicting event/type values fail closed", () => {
  assert.equal(automationMatches(rule({ event: "email.received" }), event("email.received")), true);
  assert.equal(automationMatches(rule({
    type: "whatsapp.received", event: "email.received",
  }), event("email.received")), false);
});

test("tenant mismatch rejects a generic match despite a spoofed payload organization", () => {
  assert.equal(automationMatches(rule({ event: "email.received" }),
    event("email.received", { organizationId: orgA }, orgB)), false);
  assert.equal(automationMatches(rule({ event: "email.received" }),
    event("email.received", { organizationId: orgB }, orgA)), true);
  assert.equal(automationMatches(rule({ event: "email.received" }),
    event("email.received", {}, "")), false);
});

test("missing or malformed trusted organization never reaches automation rule lookup", async () => {
  await assert.rejects(evaluateAutomationEvent(event("email.received", { organizationId: orgA }, "")), /trusted automation event organization/);
  await assert.rejects(evaluateAutomationEvent(event("email.received", {}, "not-a-uuid")), /trusted automation event organization/);
});

test("builds a stable key from provider event identity", () => {
  assert.equal(stableEventKey(event("email.action.completed", { actionId: "a-123" })),
    "email.action.completed:a-123");
});

test("prefers message identity for inbound events", () => {
  assert.equal(stableEventKey(event("whatsapp.received", {
    messageId: "m-123", correlationId: "c-1",
  })), "whatsapp.received:m-123");
});

test("returns null when an event has no durable identity", () => {
  assert.equal(stableEventKey(event("scheduled.time")), null);
});


test("email action deduplication is bound to canonical action ID, not metadata event or message IDs", () => {
  const first = event("email.action.completed", {
    actionId: "action-1", eventId: "shared-untrusted", messageId: "shared-provider-message", correlationId: "shared-correlation",
  });
  const second = event("email.action.completed", {
    actionId: "action-2", eventId: "shared-untrusted", messageId: "shared-provider-message", correlationId: "shared-correlation",
  });
  assert.equal(stableEventKey(first), "email.action.completed:action-1");
  assert.equal(stableEventKey(second), "email.action.completed:action-2");
  assert.notEqual(stableEventKey(first), stableEventKey(second));
});

test("WhatsApp outbound deduplication uses canonical message ID even if metadata event ID changes", () => {
  const first = event("whatsapp.message.sent", { messageId: "wa-row-1", eventId: "untrusted-1", correlationId: "corr-1" });
  const duplicate = event("whatsapp.message.sent", { messageId: "wa-row-1", eventId: "untrusted-2", correlationId: "corr-2" });
  assert.equal(stableEventKey(first), "whatsapp.message.sent:wa-row-1");
  assert.equal(stableEventKey(duplicate), "whatsapp.message.sent:wa-row-1");
  assert.equal(stableEventKey(first), stableEventKey(duplicate));
});

test("provider events without required canonical identity cannot use metadata to select another dedupe key", () => {
  assert.equal(stableEventKey(event("email.action.failed", { eventId: "untrusted", messageId: "wrong-kind" })), null);
  assert.equal(stableEventKey(event("whatsapp.message.sent", { eventId: "untrusted", actionId: "wrong-kind" })), null);
});
