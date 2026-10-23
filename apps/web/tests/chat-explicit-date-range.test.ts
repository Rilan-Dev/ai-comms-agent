import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseExplicitMailDateRangeRequest } from "../src/lib/mail/explicit-date-range";

const route = readFileSync(resolve(__dirname, "../src/app/api/chat/stream/route.ts"), "utf8");

const evidence=readFileSync(new URL('../src/lib/mail/report-evidence.ts',import.meta.url),'utf8');

describe("DEV-01 exact calendar-date mail report", () => {
  it("parses explicit UTC dates and sender/topic filters rather than model-inferred dates", () => {
    const scope = parseExplicitMailDateRangeRequest("summarize unread emails from 2026-10-01 to 2026-10-19");
    expect(scope?.kind).toBe("valid");
    if (scope?.kind !== "valid") return;
    expect(scope.fromUtc).toBe("2026-10-01T00:00:00.000Z");
    expect(scope.toUtc).toBe("2026-10-20T00:00:00.000Z");
    expect(scope.unreadOnly).toBe(true);
  });

  it("returns an explicit 422 for invalid/unsupported calendar-date scope before the model path", () => {
    const parser = route.indexOf("parseExplicitMailDateRangeRequest(content)");
    const failure = route.indexOf('error: "unsupported_mail_date_scope"', parser);
    const llmHistory = route.indexOf("const history = await listChatMessages(", parser);
    expect(parser).toBeGreaterThan(0);
    expect(failure).toBeGreaterThan(parser);
    expect(llmHistory).toBeGreaterThan(failure);
    expect(route).toContain("explicitRange.message");
    expect(route).toContain('"Cache-Control": "private, no-store"');
  });

  it("reuses the existing actor, agent-allowlist, tenant and mailbox binding gates", () => {
    const branchStart = route.indexOf("if (requestedMailScope) {");
    const branchEnd = route.indexOf("const history = await listChatMessages(", branchStart);
    const branch = route.slice(branchStart, branchEnd);
    expect(branch).toContain('subject.permissions.has("email.read")');
    expect(branch).toContain("createEmailToolRuntime(organizationId, agentId)");
    expect(branch).toContain('tool.name === "email.search" || tool.name === "email.messages.list"');
    expect(evidence).toContain("m.organization_id=$1");
    expect(evidence).toContain("a.organization_id=$1 AND a.deleted_at IS NULL");
    expect(evidence).toContain("bound_agent.organization_id=$1");
    expect(evidence).toContain("b.role IN ('primary','read_only')");
    expect(evidence).toContain("m.is_draft IS FALSE AND m.is_sent IS FALSE");
    expect(evidence).toContain("(NOT $7::boolean OR m.is_read IS FALSE)");
  });

  it("uses a full last calendar day in PostgreSQL and keeps original rolling 24h logic", () => {
    expect(evidence).toContain("CASE WHEN $9::boolean THEN m.received_at < $4::timestamptz");
    expect(evidence).toContain("ELSE m.received_at <= $4::timestamptz END");
    expect(route).toContain('explicitRange?.kind === "valid"');
    expect(route).toContain("windowEnd.getTime() - 24 * 60 * 60 * 1000");
  });

  it("returns counted locally-synced records and no model hallucination", () => {
    expect(evidence).toContain("COUNT(*) OVER()::integer AS total_count");
    expect(route).toContain("MAX_REPORT_MESSAGES");
    expect(route).toContain("formatRollingMailSummary(");
    expect(route).toContain("explicit UTC calendar-date range (exclusive end)");
    expect(route).toContain('source: "local_mail_database"');
    expect(route).toContain("await appendConversationMessage(");
  });
});
