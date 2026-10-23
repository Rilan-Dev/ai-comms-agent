import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseRollingMailSummaryRequest, formatRollingMailSummary } from "../src/lib/mail/rolling-summary";

const route = readFileSync(resolve(__dirname, "../src/app/api/chat/stream/route.ts"), "utf8");

describe("FIX-01 rolling 24-hour email report", () => {
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
    const query = route.indexOf("const rows = await query<RollingMailRow>", start);
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
    expect(gates).toHaveLength(2);
    for (const [expression] of gates) {
      const allowed = new Function("subject", `return ${expression};`) as
        (subject: { permissions: ReadonlySet<string> }) => boolean;
      expect(allowed({ permissions: new Set(["email.read"]) })).toBe(true);
      expect(allowed({ permissions: new Set() })).toBe(false);
      expect(allowed({ permissions: new Set(["email.send"]) })).toBe(false);
    }
  });

  it("uses exact server 24h boundaries, unread and incoming-only filters", () => {
    expect(route).toContain("windowEnd.getTime() - 24 * 60 * 60 * 1000");
    expect(route).toContain("m.received_at >= $3::timestamptz");
    expect(route).toContain("m.received_at <= $4::timestamptz");
    expect(route).toContain("m.is_draft IS FALSE AND m.is_sent IS FALSE");
    expect(route).toContain("(NOT $7::boolean OR m.is_read IS FALSE)");
  });

  it("joins only the user's organization, active agents and read-enabled bindings", () => {
    expect(route).toContain("a.organization_id = $1 AND a.deleted_at IS NULL");
    expect(route).toContain("m.organization_id = $1");
    expect(route).toContain("bound_agent.organization_id = $1");
    expect(route).toContain("b.email_account_id = a.id AND b.agent_id = $2");
    expect(route).toContain("b.role IN ('primary', 'read_only')");
  });

  it("fetches actual counted results rather than the old 20-email LLM sample", () => {
    const start = route.indexOf("const rows = await query<RollingMailRow>");
    const end = route.indexOf("const report = formatRollingMailSummary", start);
    const query = route.slice(start, end);
    expect(query).toContain("COUNT(*) OVER ()::integer AS total_count");
    expect(query).toContain("ORDER BY m.received_at DESC, m.id DESC");
    expect(query).toContain("MAX_REPORT_MESSAGES");
    expect(query).not.toContain("LIMIT 20");
  });

  it("applies user sender/topic filters rather than a fuzzy search from old assistant replies", () => {
    const start = route.indexOf("const rows = await query<RollingMailRow>");
    const end = route.indexOf("const report = formatRollingMailSummary", start);
    const query = route.slice(start, end);
    expect(query).toContain("requestedMailScope.sender ?? null");
    expect(query).toContain("requestedMailScope.topic ?? null");
    expect(query).toContain("strpos(lower(coalesce(m.from_email::text, ''))");
    expect(query).toContain("strpos(lower(coalesce(m.subject, ''))");
  });

  it("reports bounded coverage truthfully and records the actual assistant report", () => {
    expect(route).toContain("rows.rows, requestedMailScope, fromUtc, toUtc");
    expect(route).toContain('role: "assistant", content: report');
    expect(route).toContain('source: "local_mail_database", complete: true');
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
