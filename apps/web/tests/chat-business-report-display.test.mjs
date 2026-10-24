import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBusinessMailReport, safeChatLink, cleanAnswerForText } from "../src/lib/chat/business-report-display.ts";

const ID = "97998219-534b-4682-b30f-c83ac4fafdde";
const makeRow = (i, subject = "Project update") =>
  i + ". " + subject + " | From: sender" + i + "@example.com | Mailbox: inbox@example.com | Received (UTC): 2026-10-24T11:27:57.000Z\n   Available content (bounded body excerpt): Please review the details. [Open source thread](/mail/thread/" + ID + ")";
const report = (count = 2, included = count) =>
  "Locally synchronized received messages in the rolling 24-hour UTC window 2026-10-23T12:15:45.100Z to 2026-10-24T12:15:45.100Z.\nMatched: " + count + ". Included: " + included + " of " + count + ".\nNo sender or subject filter was requested.\nCoverage: all matching messages currently stored for mailboxes this agent is authorized to read.\nThis report uses local sync data; it does not prove your email provider has no newer or unsynchronized messages.\n\nMessage-by-message overview (every included message is listed):\n\n" +
  Array.from({ length: included }, (_, i) => makeRow(i + 1, i === 0 ? "Action needed: server maintenance" : "Project update")).join("\n\n") +
  "\nOldest mailbox sync: 2026-10-24T12:15:09.883Z.";

test("historic plain-text reports become exact, bounded business briefing cards", () => {
  const parsed = parseBusinessMailReport(report());
  assert.ok(parsed);
  assert.equal(parsed.kind, "messages");
  assert.equal(parsed.matched, 2);
  assert.equal(parsed.included, 2);
  assert.equal(parsed.messages.length, 2);
  assert.equal(parsed.messages[0].subject, "Action needed: server maintenance");
  assert.equal(parsed.messages[0].attention, true);
  assert.equal(parsed.messages[1].attention, false);
  assert.equal(parsed.messages[0].source, "/mail/thread/" + ID);
  assert.match(parsed.notice, /local sync data/i);
  assert.match(parsed.period, /rolling 24-hour UTC window/i);
  assert.equal(parsed.messages[0].receivedUtc, "2026-10-24T11:27:57.000Z");
});

test("95-message report remains complete and can be progressively disclosed by the UI", () => {
  const parsed = parseBusinessMailReport(report(95));
  assert.ok(parsed);
  assert.equal(parsed.messages.length, 95);
  assert.equal(parsed.included, 95);
  assert.equal(parsed.matched, 95);
});

test("per-mailbox count is never replaced by guessed totals or priority claims", () => {
  const raw = "Unread email count from locally synchronized data: 95 unread across 2 connected mailboxes.\nPer mailbox:\n- inbox@example.com: 54 unread\n- work@example.com: 41 unread\n\nNewest unread messages:\n1. Review proposal | From: manager@example.com | Mailbox: work@example.com | Received (UTC): 2026-10-24T11:27:57.000Z\n\n…and 94 more unread messages (ask for a full unread summary to list up to 500).\n\nThis report uses local sync data; it does not prove your email provider has no newer or unsynchronized messages.";
  const parsed = parseBusinessMailReport(raw);
  assert.ok(parsed);
  assert.equal(parsed.kind, "unread-count");
  assert.equal(parsed.matched, 95);
  assert.equal(parsed.mailboxes.length, 2);
  assert.equal(parsed.mailboxes[0].unread, 54);
  assert.equal(parsed.mailboxes[1].unread, 41);
  assert.equal(parsed.messages.length, 1);
  assert.equal(parsed.moreCount, 94);
});

test("malformed, untrusted or unrelated prose stays on the ordinary Markdown path", () => {
  assert.equal(parseBusinessMailReport("Hello! Subject: Welcome. I can help."), null);
  assert.equal(parseBusinessMailReport(report(4, 2).replace("Matched: 4. Included: 2 of 4", "Matched: 4. Included: 99 of 4")), null);
  assert.equal(parseBusinessMailReport(report(1).replace("Received (UTC)", "Read time")), null);
  assert.equal(parseBusinessMailReport("x".repeat(500000)), null);
});

test("thread and Markdown URLs reject script and hostile schemes", () => {
  assert.equal(safeChatLink("/mail/thread/" + ID), "/mail/thread/" + ID);
  assert.equal(safeChatLink("https://example.com/page"), "https://example.com/page");
  for (const value of ["javascript:alert(1)", "data:text/html,<script>", "//attacker.example", "file:///etc/passwd", "https://example.com/\" onmouseover=\"x", "/\\evil.example", "  https://example.com"]) {
    assert.equal(safeChatLink(value), null, value);
  }
  assert.equal(cleanAnswerForText("**Important** [Open source thread](/mail/thread/id)"), "Important Open source thread (/mail/thread/id)");
});

test("Chat shows report cards, copy and client-only Markdown/text exports", () => {
  const client = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  const card = readFileSync(new URL("../src/app/chat/business-mail-report.tsx", import.meta.url), "utf8");
  const controls = readFileSync(new URL("../src/app/chat/answer-actions.tsx", import.meta.url), "utf8");
  assert.match(client, /parseBusinessMailReport\(content\)/);
  assert.match(client, /<BusinessMailReport report=\{businessReport\}/);
  assert.match(client, /<AnswerActions content=\{content\}/);
  assert.match(client, /safeChatLink\(match!\[2\]/);
  assert.match(card, /Show next/);
  assert.match(card, /local sync/i);
  assert.match(controls, /navigator\.clipboard\.writeText/);
  assert.match(controls, /new Blob\(/);
  assert.match(controls, /URL\.createObjectURL/);
  assert.doesNotMatch(controls, /fetch\(|localStorage|sessionStorage/);
});
