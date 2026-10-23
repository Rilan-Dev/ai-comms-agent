import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { describeBriefingSource } from "../src/lib/briefings/source-email-display.ts";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("recognizable source email details use the canonical sender, subject and an explicitly UTC instant", () => {
  const result = describeBriefingSource({
    subject: "Your appointment", sender: "service@example.org", receivedAt: "2026-10-23T09:15:00.000Z",
  });
  assert.equal(result.subject, "Your appointment");
  assert.equal(result.sender, "service@example.org");
  assert.equal(result.receivedAtIso, "2026-10-23T09:15:00.000Z");
  assert.match(result.receivedLabel, /2026-10-23 09:15 UTC/);
});

test("unknown, malformed and empty metadata never become invented email facts", () => {
  for (const value of [null, {}, { subject: "", sender: "  ", receivedAt: "not-a-date" }, {
    subject: {}, sender: [], receivedAt: 123,
  }]) {
    const display = describeBriefingSource(value);
    assert.equal(display.subject, "Subject unavailable");
    assert.equal(display.sender, "Sender unavailable");
    assert.equal(display.receivedLabel, "Received time unavailable");
    assert.equal(display.receivedAtIso, null);
  }
});

test("long or untrusted email headers remain bounded plain text, without accepting markup as code", () => {
  const display = describeBriefingSource({
    subject: "<img src=x onerror=alert(1)>\n".repeat(30), sender: "user@example.com\r\nBCC:bad@example.com",
    receivedAt: "2026-10-23T09:15:00+05:30",
  });
  assert.ok(display.subject.length <= 163);
  assert.doesNotMatch(display.sender, /[\r\n]/);
  assert.equal(display.receivedAtIso, "2026-10-23T03:45:00.000Z");
});

test("briefing source pagination joins only existing owner/agent scoped, canonical tenant messages", () => {
  const source = read("../../../packages/db/src/briefings/coverage.ts");
  const beginning = source.indexOf("export async function listBriefingSources(");
  const ending = source.indexOf("async function authorizeRoutineWork(", beginning);
  assert.ok(beginning >= 0 && ending > beginning);
  const query = source.slice(beginning, ending);
  assert.match(query, /await currentManifest\(client, p, id\)/);
  assert.match(query, /JOIN email_messages m ON m\.id=s\.email_message_id/);
  assert.match(query, /m\.organization_id=s\.organization_id AND m\.email_account_id=s\.mailbox_id/);
  assert.match(query, /s\.organization_id=\$4 AND s\.owner_user_id=\$5 AND s\.agent_id=\$6/);
  assert.match(query, /m\.subject,m\.from_email,m\.received_at/);
  assert.match(query, /subject: s\.subject, sender: s\.from_email/);
  assert.match(query, /nextCursor: rows\.length > limit/);
  assert.doesNotMatch(query, /text_body|html_body|attachment|sendDraft\(/);
});

test("catch-up presents original subject and sender with source links, never fabricated AI priorities", () => {
  const page = read("../src/app/catch-up/catch-up-client.tsx");
  assert.match(page, /describeBriefingSource\(source\)/);
  assert.match(page, /details\.subject/);
  assert.match(page, /details\.sender/);
  assert.match(page, /details\.receivedLabel/);
  assert.match(page, /Open original email/);
  assert.match(page, /Source email links loaded/);
  assert.match(page, /C3 source-grounded AI generation is not yet running automatically/);
});
