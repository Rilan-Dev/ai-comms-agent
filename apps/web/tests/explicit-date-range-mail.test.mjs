import test from "node:test";
import assert from "node:assert/strict";
import { parseExplicitMailDateRangeRequest, MAX_EXPLICIT_MAIL_DAYS } from "../src/lib/mail/explicit-date-range.ts";
import { formatRollingMailSummary } from "../src/lib/mail/rolling-summary.ts";

const parse = parseExplicitMailDateRangeRequest;
test("resolves complete calendar days with exclusive next-midnight UTC end", () => {
  assert.deepEqual(parse("summarize all unread emails from 2026-10-01 to 2026-10-19"), {
    kind: "valid", firstDate: "2026-10-01", lastDate: "2026-10-19",
    fromUtc: "2026-10-01T00:00:00.000Z", toUtc: "2026-10-20T00:00:00.000Z",
    unreadOnly: true,
  });
});
test("supports explicit between-and format and leap-day across leap year", () => {
  const out = parse("list mail between 2024-02-28 and 2024-02-29");
  assert.equal(out?.kind, "valid");
  assert.equal(out.toUtc, "2024-03-01T00:00:00.000Z");
  assert.equal(out.fromUtc, "2024-02-28T00:00:00.000Z");
});
test("preserves dotted sender domains and mailbox read scope", () => {
  const out = parse("summarize unread emails from alice.smith@example.co.uk between 2026-10-10 and 2026-10-14");
  assert.equal(out?.kind, "valid");
  assert.equal(out.sender, "alice.smith@example.co.uk");
  assert.equal(out.unreadOnly, true);
});
test("keeps a separate subject/topic filter rather than broadening to all mail", () => {
  const out = parse("show messages between 2026-09-01 and 2026-09-30 about Qdrant");
  assert.equal(out?.kind, "valid");
  assert.equal(out.topic, "Qdrant");
});
test("rejects reversed, invalid, incomplete or excessive calendar ranges", () => {
  const bad = [
    "list emails from 2026-10-20 to 2026-10-01",
    "show mail between 2026-02-30 and 2026-03-04",
    "summary of emails from 2026-10-10 to 2026-10-",
    "show emails from 2023-01-01 to 2025-01-01",
    "list mails from 2026-10-01 to 2026-10-04 and 2026-10-05",
  ];
  for (const input of bad) assert.equal(parse(input)?.kind, "invalid", input);
  assert.equal(MAX_EXPLICIT_MAIL_DAYS, 366);
});
test("refuses unsupported filters and ambiguous senders instead of querying all", () => {
  const bad = [
    "show emails between 2026-10-01 and 2026-10-10 excluding invoices",
    "summarize unread emails from Alice between 2026-10-01 and 2026-10-10",
    "list messages between 2026-10-01 and 2026-10-10 with attachments",
    "list urgent emails from 2026-10-01 to 2026-10-10",
    "list emails before 2026-10-01 to 2026-10-10",
  ];
  for (const input of bad) assert.equal(parse(input)?.kind, "invalid", input);
});
test("does not hijack unrelated chat or existing rolling summaries", () => {
  assert.equal(parse("hello"), null);
  assert.equal(parse("show unread mail for the last 24 hours"), null);
  assert.equal(parse("find mail from Alice"), null);
});
test("reuses complete counted local report without claiming live sync", () => {
  const scope = parse("summarize unread emails from 2026-10-01 to 2026-10-19");
  assert.equal(scope?.kind, "valid");
  const rows = [
    { id: "1", account_email: "a@example.com", from_email: "sender@example.com", from_name: null,
      subject: "Invoice", received_at: "2026-10-18T09:00:00.000Z",
      snippet: "A", text_body: "An invoice", total_count: 1 },
  ];
  const report = formatRollingMailSummary(rows, scope, scope.fromUtc, scope.toUtc, "explicit UTC calendar-date range (exclusive end)");
  assert.match(report, /explicit UTC calendar-date range/);
  assert.match(report, /Matched: 1\. Included: 1 of 1/);
  assert.match(report, /Invoice \| From: sender@example.com/);
  assert.match(report, /does not prove your email provider/);
});
