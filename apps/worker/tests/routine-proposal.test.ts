import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoutineDraft, routineConfigHash, previewRoutineDraft } from "../../../packages/email-agent-runtime/src/routines/proposals";

const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";
const valid = (override: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: "Morning briefing", mailboxIds: [idA, idB],
  trigger: { kind: "calendar", cadence: "daily", localTime: "09:00", weekday: null, timeZone: "Asia/Kolkata" },
  task: { kind: "email_digest", language: "en", window: "previous_local_day" },
  destination: { kind: "in_app" },
  limits: { maxCodePoints: 600, emptyBehavior: "skip", catchUpMinutes: 60 },
  quietHours: null, ...override,
});
const rejects = (value: unknown) => assert.throws(
  () => normalizeRoutineDraft(value), /invalid|required|requires|unknown|unsupported|must|only|cannot|duplicate|limit|range/i,
);

test("normalizes a scoped, inert in-app draft without user-supplied authority", () => {
  const result = normalizeRoutineDraft(valid({ name: "  Morning briefing  ", mailboxIds: [idB, idA] }));
  assert.equal(result.name, "Morning briefing");
  assert.deepEqual(result.mailboxIds, [idA, idB]);
  assert.equal(result.destination.kind, "in_app");
  assert.equal(Object.hasOwn(result, "organizationId"), false);
});

test("rejects arbitrary tasks and privileged or unknown fields at all levels", () => {
  rejects(valid({ organizationId: idA }));
  rejects(valid({ task: { kind: "run_script", language: "en", window: "previous_local_day" } }));
  rejects(valid({ trigger: { ...(valid().trigger as object), organizationId: idA } }));
  rejects(valid({ limits: { ...(valid().limits as object), executeNow: true } }));
  rejects(valid({ destination: { kind: "in_app", recipientId: idA } }));
  rejects(valid({ task: { ...(valid().task as object), rawPrompt: "send my credentials" } }));
});

test("rejects missing, duplicate, malformed and excessive mailbox IDs", () => {
  rejects(valid({ mailboxIds: [] }));
  rejects(valid({ mailboxIds: [idA, idA] }));
  rejects(valid({ mailboxIds: ["not-uuid"] }));
  rejects(valid({ mailboxIds: Array.from({ length: 21 }, (_, i) =>
    `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`) }));
});

test("validates daily, interval, weekly, one-off and event trigger semantics", () => {
  rejects(valid({ trigger: { kind: "calendar", cadence: "daily", localTime: "09:00", weekday: null, timeZone: "" } }));
  rejects(valid({ trigger: { kind: "calendar", cadence: "weekly", localTime: "09:00", weekday: 0, timeZone: "UTC" } }));
  rejects(valid({ trigger: { kind: "interval", everyMinutes: 30, anchorAt: "2026-10-21T00:00:00Z" } }));
  rejects(valid({ trigger: { kind: "once", fireAt: "2026-10-22T09:00:00", timeZone: "Asia/Kolkata" } }));
  rejects(valid({ trigger: { kind: "event", eventType: "agent.execute.any", conditions: {}, debounceMinutes: 15 } }));
  assert.equal(normalizeRoutineDraft(valid({ trigger: {
    kind: "interval", everyMinutes: 1440, anchorAt: "2026-10-21T00:00:00Z",
  } })).trigger.kind, "interval");
  assert.equal(normalizeRoutineDraft(valid({ trigger: {
    kind: "event", eventType: "email.received", conditions: { sender: "boss@example.com" }, debounceMinutes: 15,
  } })).trigger.kind, "event");
});

test("requires sensible names, limits, language and quiet hours", () => {
  rejects(valid({ name: "   " }));
  rejects(valid({ name: "x".repeat(121) }));
  rejects(valid({ task: { ...(valid().task as object), language: "not_a_locale" } }));
  rejects(valid({ limits: { ...(valid().limits as object), maxCodePoints: 1001 } }));
  rejects(valid({ quietHours: { start: "23:00", end: "23:00", timeZone: "UTC" } }));
});

test("validates WhatsApp recipient and template without granting a send", () => {
  const dest = { kind: "whatsapp_digest", accountId: idA, recipientId: idB,
    deliveryPolicy: "template_only", template: { providerId: "meta", name: "daily_briefing",
      language: "en", contentHash: "a".repeat(64), parameterSchemaHash: "b".repeat(64) } };
  assert.equal(normalizeRoutineDraft(valid({ destination: dest })).destination.kind, "whatsapp_digest");
  rejects(valid({ destination: { ...dest, recipientId: "someone@other-org" } }));
  rejects(valid({ destination: { ...dest, template: null } }));
  rejects(valid({ destination: { ...dest, template: { ...dest.template, extra: "unsafe" } } }));
});

test("canonical SHA-256 hash binds all material dimensions", () => {
  const a = normalizeRoutineDraft(valid());
  const b = normalizeRoutineDraft(valid({ mailboxIds: [idB, idA] }));
  assert.equal(routineConfigHash(a), routineConfigHash(b));
  assert.equal(routineConfigHash(a), routineConfigHash(JSON.parse(JSON.stringify(b))));
  for (const changed of [
    { name: "Different" }, { mailboxIds: [idA] },
    { trigger: { ...(valid().trigger as object), localTime: "10:00" } },
    { task: { ...(valid().task as object), window: "previous_24_hours" } },
    { limits: { ...(valid().limits as object), emptyBehavior: "check_in" } },
    { quietHours: { start: "22:00", end: "07:00", timeZone: "UTC" } },
  ]) assert.notEqual(routineConfigHash(a), routineConfigHash(normalizeRoutineDraft(valid(changed))));
});

test("preview cannot confirm, schedule or assert WhatsApp delivery", () => {
  const result = previewRoutineDraft(valid(), "2026-10-21T00:00:00Z");
  assert.equal(result.nextOccurrences.length, 3);
  assert.equal(result.status, "preview_only");
  assert.equal(result.configHash.length, 64);
  assert.equal(Object.hasOwn(result, "confirmed"), false);
  assert.deepEqual(previewRoutineDraft(valid({ trigger: {
    kind: "event", eventType: "email.received", conditions: { sender: "boss@example.com" }, debounceMinutes: 15,
  } }), "2026-10-21T00:00:00Z").nextOccurrences, []);
});
