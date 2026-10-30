import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseRollingMailSummaryRequest, formatRollingMailSummary } from "../src/lib/mail/rolling-summary";

const route = readFileSync(resolve(__dirname, "../src/app/api/chat/stream/route.ts"), "utf8");

describe("FIX-01 rolling 24-hour email report", () => {
  it('accepts detailed output columns without treating sender/subject as filters',()=>{
    expect(parseRollingMailSummaryRequest('Summarize all emails received in the last 24 hours. Include sender, subject, received time, mailbox, preview and coverage.')).toEqual({hours:24,unreadOnly:false});
  });
  it('keeps an explicit mailbox separate from a sender filter',()=>{
    expect(parseRollingMailSummaryRequest('Summarize unread emails in mailbox two@example.com from the last 24 hours')).toEqual({hours:24,unreadOnly:true,mailbox:'two@example.com'});
  });
  it("interprets the reported user request accurately, without prior AI context", () => {
    expect(parseRollingMailSummaryRequest("Please Summery My Last Unreaded Mesaages from last 24hours"))
      .toEqual({ hours: 24, unreadOnly: true });
    expect(parseRollingMailSummaryRequest("Can you please let me know last 24 hours emails received in my workspace?"))
      .toEqual({ hours: 24, unreadOnly: false });
    expect(route.indexOf("parseRollingMailSummaryRequest(content)"))
      .toBeLessThan(route.indexOf("const history = await listChatMessages("));
  });

  it("requires email.read AND persisted agent tool allowlist before direct message query", () => {
    const start = route.indexOf("const rollingMail = parseRollingMailSummaryRequest(content)");
    const query = route.indexOf("const evidence = await getMailReportEvidence", start);
    const scope = route.slice(start, query);
    expect(scope).toContain('subject.permissions.has("email.read")');
    expect(scope).toContain("createEmailToolRuntime(organizationId, agentId)");
    expect(scope).toContain("mailRuntime.registry.listForAgent(agentId)");
    expect(scope).toContain('tool.name === "email.search" || tool.name === "email.messages.list"');
  });

  it("evaluates both mail permission gates with real authorization Sets", () => {
    // Execute the production expressions: the old Array.includes contract
    // passed textual tests but threw for every real authenticated subject.
    const gates = [...route.matchAll(/subject\.permissions\.[a-z]+\("email\.read"\)/g)];
    expect(gates.length).toBeGreaterThanOrEqual(2); // The @email mention gate adds an independent check.
    for (const [expression] of gates) {
      const allowed = new Function("subject", `return ${expression};`) as
        (subject: { permissions: ReadonlySet<string> }) => boolean;
      expect(allowed({ permissions: new Set(["email.read"]) })).toBe(true);
      expect(allowed({ permissions: new Set() })).toBe(false);
      expect(allowed({ permissions: new Set(["email.send"]) })).toBe(false);
    }
  });

  it("reports bounded coverage truthfully and records the actual assistant report", () => {
    expect(route).toContain("evidence.rows, requestedMailScope, fromUtc, toUtc");
    expect(route).toContain('role: "assistant", content: report');
    expect(route).toContain('source: "local_mail_database", complete: !evidence.hasMore');
    const sample = Array.from({ length: 37 }, (_, i) => ({
      id: String(i), account_email: "a@example.com", from_email: "sender@example.com", from_name: null,
      subject: `Subject ${i}`, received_at: "2026-10-18T18:00:00Z", snippet: "Sample",
      text_body: null, total_count: 37,
    }));
    const result = formatRollingMailSummary(sample, { unreadOnly: true }, "2026-10-17T18:00:00Z", "2026-10-18T18:00:00Z");
    expect(result).toContain("Matched: 37. Included: 37 of 37.");
    expect(result).toContain("Subject 36");
  });
});
