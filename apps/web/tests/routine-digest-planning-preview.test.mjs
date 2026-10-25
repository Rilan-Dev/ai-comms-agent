import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { parseDigestPreviewPreferences, describeDigestPreview } from "../src/lib/routines/digest-preview-preferences.ts";

const defaults = { window: "previous_local_day", language: "en", delivery: "in_app", focus: "needs_attention", maxCodePoints: 600, emptyBehavior: "skip" };

test("an ordinary person's digest plan has explicit safe, non-executable defaults", () => {
  assert.deepEqual(parseDigestPreviewPreferences({}), defaults);
  assert.deepEqual(parseDigestPreviewPreferences({ window: "", language: "", delivery: "", focus: "", maxCodePoints: "", emptyBehavior: "" }), defaults);
});

test("supports reviewed daily local-day, hourly 24h, and source-scoped incremental plans without conflating them", () => {
  assert.equal(parseDigestPreviewPreferences({ window: "previous_local_day" }).window, "previous_local_day");
  assert.equal(parseDigestPreviewPreferences({ window: "previous_24_hours" }).window, "previous_24_hours");
  assert.equal(parseDigestPreviewPreferences({ window: "since_previous_occurrence" }).window, "since_previous_occurrence");
  assert.equal(parseDigestPreviewPreferences({ language: "ta", focus: "all_new", maxCodePoints: "300", emptyBehavior: "check_in" }).language, "ta");
  assert.equal(parseDigestPreviewPreferences({ maxCodePoints: "1000" }).maxCodePoints, 1000);
});

test("rejects unsupported and repeated query controls instead of accepting implied privileges", () => {
  for (const bad of [
    { window: "all_company_email" }, { delivery: "send_now" }, { delivery: "auto_send_email" },
    { language: "unknown" }, { language: ["en", "ta"] }, { focus: "ignore_security" },
    { maxCodePoints: "1001" }, { maxCodePoints: "-1" }, { maxCodePoints: "600.2" },
    { emptyBehavior: "send_everything" },
  ]) assert.throws(() => parseDigestPreviewPreferences(bad), /Choose a supported/);
});

test("WhatsApp is a preference for future confirmation, never active send authorization", () => {
  const selections = parseDigestPreviewPreferences({ delivery: "whatsapp_digest", window: "previous_24_hours" });
  const description = describeDigestPreview(selections);
  assert.match(description.delivery, /not activated/i);
  assert.match(description.delivery, /verified recipient/i);
  assert.match(description.delivery, /separate consent/i);
  assert.match(description.window, /24 elapsed hours/i);
  assert.match(description.review, /not saved or scheduled/i);
  assert.doesNotMatch(JSON.stringify(selections), /recipientId|organizationId|auth|email.write|sendToken/);
});

test("source-first priority and safe length/empty-result language stay understandable", () => {
  const description = describeDigestPreview(defaults);
  assert.match(description.scope, /only the mailboxes you are permitted to read/i);
  assert.match(description.priority, /Needs attention/);
  assert.match(description.priority, /Worth reviewing/);
  assert.match(description.priority, /For reference/);
  assert.match(description.priority, /original message/i);
  assert.match(description.delivery, /inside this platform/i);
  assert.match(description.limit, /600/);
  assert.match(description.empty, /skip/i);
});

test("the authenticated timing page integrates a real form and preview, never creates a routine or delivery", () => {
  const page = readFileSync(new URL("../src/app/routines/preview/page.tsx", import.meta.url), "utf8");
  const overview = readFileSync(new URL("../src/app/overview/page.tsx", import.meta.url), "utf8");
  assert.match(page, /parseDigestPreviewPreferences\(raw\)/);
  assert.match(page, /describeDigestPreview\(digestPreferences\)/);
  for (const name of ["window", "language", "delivery", "focus", "maxCodePoints", "emptyBehavior"]) {
    assert.match(page, new RegExp('name="' + name + '"'));
  }
  assert.match(page, /role="alert"/);
  assert.match(page, /Nothing is saved or scheduled from this preview/);
  assert.match(page, /Missing mailbox authorization/);
  assert.doesNotMatch(page, /createScheduledJob|createAutomationRule|requestWhatsAppSend|sendDraft\(/);
  assert.match(overview, /href="\/routines\/preview"/);
});
