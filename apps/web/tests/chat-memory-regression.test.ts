// Regression protection for AI chat memory / context pollution fix +
// ISS-026 closure (agent-scoped email context).
//
// Verifies the loadEmailContext SQL and message ordering invariants
// hold against the chat stream route source, AND that the email
// context is scoped to the active agent's mailbox bindings (not just
// organization membership).
//
// Background:
//   Before ISS-026 closure, an agent could receive local email context
//   from another agent's mailbox in the same organization, because the
//   SQL filtered by organization_id only. The fix JOINs
//   agent_email_accounts and requires the binding role to grant READ
//   access ('primary' or 'read_only').
//
//   Before the memory / context pollution fix, when a user asked a
//   follow-up like "Show me the exact emails here" after asking about
//   emails from mohammedrilan.ksa@gmail.com, the AI dumped 16+ random
//   recent emails instead of showing the 2 specific emails from the
//   previous turn. Root cause was:
//     1. SQL fallback `OR m.received_at >= now() - interval '7 days'`
//        polluted the email context with 20 random recent emails,
//        drowning the 2 matching ones.
//     2. Email context system message was placed BEFORE conversation
//        history, biasing the LLM toward dumping the email list rather
//        than recognizing the user's reference to "the exact emails"
//        from the previous turn.
//
// These tests verify the structural invariants that prevent regression.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(__dirname, "../src/app/api/chat/stream/route.ts");
const routeSource = readFileSync(routePath, "utf8");
const runtimePath = resolve(__dirname, "../../../packages/clara-core/src/runtime.ts");
const runtimeSource = readFileSync(runtimePath, "utf8");

describe("chat email context — memory / context pollution regression", () => {
  it("loadEmailContext does NOT use the 7-day fallback when search terms are present", () => {
    // The fix branches on `hasTerms = searchTerms.length > 0` and uses
    // two different SQL fragments. The 7-day fallback must ONLY appear
    // in the no-terms branch.
    const hasTermsBranch = routeSource.indexOf("hasTerms = searchTerms.length > 0");
    expect(hasTermsBranch).toBeGreaterThan(0);

    // Confirm the 7-day fallback only appears once (in the no-terms branch)
    const fallbackCount = (routeSource.match(/received_at >= now\(\) - interval '7 days'/g) ?? []).length;
    expect(fallbackCount).toBe(1);

    // Confirm the matching-term branch uses EXISTS / unnest with from_email
    // (so sender-specific searches work). NOTE: parameter index is $3 after
    // ISS-026 closure (layout is now $1=orgId, $2=agentId, $3=searchTerms).
    const matchBranch = routeSource.indexOf("AND EXISTS (SELECT 1 FROM unnest($3::text[]) AS term");
    expect(matchBranch).toBeGreaterThan(0);
    expect(routeSource).toContain("COALESCE(m.from_email, '') ILIKE '%' || term || '%'");
  });

  it("loadEmailContext includes the conversation-history awareness instruction in the system message", () => {
    // The system message must instruct the LLM to NOT dump the entire
    // context list when the user references "those emails" / "the emails"
    // / specific Email N from a previous turn.
    expect(routeSource).toContain("do NOT dump the entire context list");
    expect(routeSource).toContain("those emails");
    expect(routeSource).toContain("previous turn");
  });

  it("message ordering puts conversation history BEFORE the email context system message", () => {
    // The fix reorders messages so conversation history comes FIRST,
    // then the email context system message, then the current user
    // message. This ensures the LLM sees the conversational flow before
    // the email context dump, so it can resolve references like "those
    // emails" to the previous turn's answer.
    const filteredHistoryPos = routeSource.indexOf("...filteredHistory,");
    const emailContextPos = routeSource.indexOf('...(emailContext ? [{ role: "system" as const, content: emailContext }] : []),');

    expect(filteredHistoryPos).toBeGreaterThan(0);
    expect(emailContextPos).toBeGreaterThan(0);
    expect(filteredHistoryPos).toBeLessThan(emailContextPos);

    // Confirm the current user message is placed LAST
    const currentUserPos = routeSource.indexOf('{ role: "user" as const, content },');
    expect(currentUserPos).toBeGreaterThan(emailContextPos);
  });

  it("combined search context includes recent user AND assistant messages for follow-up resolution", () => {
    // The fix (commit 09922bf1) built combinedSearchContext from the last
    // 3 user messages + current message. Commit (0b8449e6) extended this
    // to include the last 6 user+assistant messages, because the previous
    // AI response is the only place where the explicit sender email
    // address (e.g. "mohammedrilan.ksa@gmail.com") appears — the user's
    // original query said "mohammed rilan ksa" without the @ symbol.
    expect(routeSource).toContain('m.role === "user" || m.role === "assistant"');
    expect(routeSource).toContain("recentMessages");
    expect(routeSource).toContain("combinedSearchContext");
  });

  it("loadEmailContext prioritizes email addresses as search terms", () => {
    // Email addresses are the highest-precision search signal. The fix
    // separates email-address tokens from other tokens and places them
    // at the front of the search terms array.
    expect(routeSource).toContain('const emailAddresses = allTokens.filter((t) => t.includes("@"))');
    expect(routeSource).toContain('const searchTerms = [...emailAddresses, ...otherTerms].slice(0, 8)');
  });

  it("loadEmailContext excludes pure-digit tokens (years) from search terms", () => {
    // Pure 4-digit tokens like "2026" match date-containing subjects
    // (e.g. "Product Release Notes: Oct 13, 2026") and pollute results.
    expect(routeSource).toContain('/^\\d+$/.test(t)');
  });
});

describe("ISS-026 — agent-scoped email context (cross-agent mailbox isolation)", () => {
  it("loadEmailContext signature takes agentId as the second parameter", () => {
    // The signature must be (organizationId, agentId, content) — agentId
    // is required to JOIN agent_email_accounts. Without this parameter,
    // the function cannot scope to the active agent's mailbox bindings.
    expect(routeSource).toContain("async function loadEmailContext(organizationId: string, agentId: string, content: string)");
  });

  it("loadEmailContext caller in the chat route passes agentId", () => {
    // The caller at the POST handler must pass agentId, not just
    // organizationId + content. This is the actual ISS-026 fix point.
    expect(routeSource).toContain("loadEmailContext(organizationId, agentId, combinedSearchContext)");
  });

  it("loadEmailContext SQL JOINs agent_email_accounts with role filter", () => {
    // The SQL must JOIN agent_email_accounts and filter by:
    //   - b.email_account_id = a.id (the join)
    //   - b.agent_id (parameterized via $agentId template, replaced with $2 at runtime)
    //   - b.role IN ('primary', 'read_only') — read entitlement only
    // 'send_only' agents must NOT see inbox emails via this path.
    expect(routeSource).toContain("JOIN agent_email_accounts b");
    expect(routeSource).toContain("b.email_account_id = a.id");
    expect(routeSource).toContain("b.agent_id = $agentId");
    expect(routeSource).toContain('agentScopeSql.replace(/\\$agentId/g, "$2")');
    expect(routeSource).toContain("b.role IN ('primary', 'read_only')");
  });

  it("loadEmailContext parameters include agentId at position 2", () => {
    // The params array must be [organizationId, agentId, ...]. When
    // search terms are present, the layout is [orgId, agentId, searchTerms].
    // When no terms, [orgId, agentId].
    expect(routeSource).toContain("[organizationId, agentId, searchTerms]");
    expect(routeSource).toContain("[organizationId, agentId]");
  });

  it("groundContext email_messages query (clara-core runtime) is also agent-scoped", () => {
    // ISS-026 closure must cover BOTH paths:
    //   1. apps/web/src/app/api/chat/stream/route.ts:loadEmailContext()
    //      (covered by tests above)
    //   2. packages/clara-core/src/runtime.ts:groundContext() — the
    //      email_messages direct query inside the hybrid retriever.
    // The runtime path is called via claraRuntime.createChatTurn() with
    // ragMode='hybrid', which is the chat + realtime voice path.
    // Without this JOIN, an agent could read another agent's mailbox
    // via the runtime retriever even if loadEmailContext is scoped.
    expect(runtimeSource).toContain("JOIN agent_email_accounts b");
    expect(runtimeSource).toContain("b.email_account_id = em.email_account_id");
    expect(runtimeSource).toContain("b.agent_id = $2");
    expect(runtimeSource).toContain("b.role IN ('primary', 'read_only')");
  });

  it("groundContext uses a clean, unambiguous parameter layout", () => {
    // The pre-ISS-026 code had a parameter mismatch bug: the SQL used
    // $4 for textQuery and $5 for email/nameFragment, but the params
    // array started with [orgId, textQuery, ...] so $4 actually
    // pointed at an email address and $5 was undefined. The fix
    // standardizes on:
    //   $1 = orgId, $2 = agentId, $3 = textQuery, $4 = lookupTerms[]
    expect(runtimeSource).toContain("[ctx.orgId, ctx.agentId, textQuery, lookupTerms]");
    expect(runtimeSource).toContain("em.search_vector @@ to_tsquery('simple', $3)");
    expect(runtimeSource).toContain("unnest($4::text[]) AS term");
  });

  it("loadEmailContext empty-result message is agent-scoped, not organization-scoped", () => {
    // When no emails match, the message should reflect that the agent
    // has no bound mailboxes (or no matching emails in bound mailboxes),
    // not that the organization has no emails. This phrasing prevents
    // the LLM from claiming it has read mailbox contents the agent
    // doesn't actually have access to.
    expect(routeSource).toContain("agent's bound mailboxes");
  });
});
