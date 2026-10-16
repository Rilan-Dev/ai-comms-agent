// Regression protection for AI chat memory / context pollution fix.
// Verifies the loadEmailContext SQL and message ordering invariants
// hold against the chat stream route source.
//
// Background:
//   Before this fix, when a user asked a follow-up like "Show me the
//   exact emails here" after asking about emails from
//   mohammedrilan.ksa@gmail.com, the AI dumped 16+ random recent
//   emails instead of showing the 2 specific emails from the previous
//   turn. Root cause was:
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
    // (so sender-specific searches work)
    const matchBranch = routeSource.indexOf("AND EXISTS (SELECT 1 FROM unnest($2::text[]) AS term");
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

  it("combined search context includes recent user messages for follow-up resolution", () => {
    // The fix (commit 09922bf1) builds combinedSearchContext from the
    // last 3 user messages + current message. This must remain.
    expect(routeSource).toContain('history.filter(m => m.role === "user").slice(-3)');
    expect(routeSource).toContain("combinedSearchContext");
  });
});
