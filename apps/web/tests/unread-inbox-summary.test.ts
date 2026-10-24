import { describe, expect, it } from "vitest";
import {
  formatUnreadMailCountReport,
  parseUnreadOnlyMailRequest,
  type MailboxUnreadCount,
} from "@/lib/mail/unread-inbox-summary";
import type { RollingMailRow } from "@/lib/mail/rolling-summary";

describe("parseUnreadOnlyMailRequest", () => {
  it("accepts a pure unread summary request", () => {
    expect(parseUnreadOnlyMailRequest("Summarize my unread emails")).toEqual({
      kind: "summary",
      unreadOnly: true,
      sender: undefined,
      topic: undefined,
    });
  });

  it("accepts a plain how-many question as a count request", () => {
    expect(parseUnreadOnlyMailRequest("How many unread emails do I have?")?.kind).toBe("count");
    expect(parseUnreadOnlyMailRequest("How many unread emails do I have right now?")?.kind).toBe("count");
    expect(parseUnreadOnlyMailRequest("Show unread messages count")?.kind).toBe("count");
  });

  it("accepts whats-new phrasing", () => {
    expect(parseUnreadOnlyMailRequest("What's new in my inbox?")?.kind).toBe("summary");
  });

  it("rejects analysis asks like business highlighting", () => {
    expect(parseUnreadOnlyMailRequest("Summarize my unread emails and highlight business mails. Keep it short.")).toBeNull();
  });

  it("rejects a named mailbox so the scope is never silently dropped", () => {
    expect(parseUnreadOnlyMailRequest("Show unread emails count for mohammedrilan20022002@gmail.com")).toBeNull();
    expect(parseUnreadOnlyMailRequest("Summarize my unread emails in my gmail account")).toBeNull();
  });

  it("rejects the historical production repro sentence", () => {
    expect(parseUnreadOnlyMailRequest(
      "summery my mohammedrilan20022002@gmail.com emails all unreaded mails and high light business mails as well",
    )).toBeNull();
  });

  it("rejects time-window requests so the rolling report path owns them", () => {
    expect(parseUnreadOnlyMailRequest("Summarize unread emails from the last 24 hours")).toBeNull();
    expect(parseUnreadOnlyMailRequest("Show unread emails from today")).toBeNull();
  });

  it("rejects triage, non-mail, and long prompts", () => {
    expect(parseUnreadOnlyMailRequest("What needs my attention today?")).toBeNull();
    expect(parseUnreadOnlyMailRequest("Summarize my recent emails")).toBeNull();
    expect(parseUnreadOnlyMailRequest("hello")).toBeNull();
    expect(parseUnreadOnlyMailRequest("unread ".repeat(40))).toBeNull();
  });

  it("rejects sender or topic constraints", () => {
    expect(parseUnreadOnlyMailRequest("Summarize unread emails from Sarah")).toBeNull();
    expect(parseUnreadOnlyMailRequest("Show unread emails about the invoice")).toBeNull();
  });
});

describe("formatUnreadMailCountReport", () => {
  const counts: MailboxUnreadCount[] = [
    { account_email: "a@example.com", unread_count: 7 },
    { account_email: "b@example.com", unread_count: 5 },
  ];
  const rows = [] as unknown as RollingMailRow[];

  it("reports the total and per-mailbox counts", () => {
    const report = formatUnreadMailCountReport(counts, rows);
    expect(report).toContain("12 unread across 2 connected mailboxes");
    expect(report).toContain("a@example.com: 7 unread");
    expect(report).toContain("b@example.com: 5 unread");
    expect(report).toContain("local sync data");
  });

  it("reports zero unread honestly", () => {
    const report = formatUnreadMailCountReport([], []);
    expect(report).toContain("0 unread across 0 connected mailboxes");
    expect(report).toContain("no unread emails");
  });

  it("lists the newest unread messages when rows are present", () => {
    const withRows = [
      { subject: "Quarterly report", from_name: "Finance", from_email: "fin@example.com", account_email: "a@example.com", received_at: "2026-10-24T00:00:00.000Z" },
      { subject: "Hello", from_name: "Bob", from_email: "bob@example.com", account_email: "a@example.com", received_at: "2026-10-23T00:00:00.000Z" },
    ] as unknown as RollingMailRow[];
    const report = formatUnreadMailCountReport(counts, withRows);
    expect(report).toContain("Newest unread messages:");
    expect(report).toContain("Quarterly report");
    expect(report).toContain("…and 10 more unread messages");
  });
});
