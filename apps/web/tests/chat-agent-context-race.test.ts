import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
function section(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < from) throw new Error("Missing ChatClient routine: " + start);
  return source.slice(from, to);
}
const switcher = section("async function switchAgent(", "async function returnFromVoice()");
const voiceReturn = section("async function returnFromVoice()", "async function openMailComposer(");
const setup = section("async function openMailComposer(", "async function submitMailCompose(");
const submit = section("async function submitMailCompose(", "async function reloadMailPermissions()");
const composeUI = section('<section aria-label="Compose an email using this agent"', "Review approvals");

describe("FIX-01: agent conversation and email compose context races", () => {
  it("does not show the new agent with the old conversation during a pending switch", () => {
    expect(switcher).toContain("agentSwitchInFlightRef.current = true;");
    expect(switcher).toContain("const epoch = ++agentContextEpochRef.current");
    expect(switcher.indexOf("setAgentId(nextAgentId)")).toBeGreaterThan(switcher.indexOf("if (!response.ok)"));
    expect(switcher).toContain("message.conversationId !== payload.conversation?.id");
    expect(switcher).toContain("setConversationId(payload.conversation.id)");
    expect(switcher).toContain("setMessages(payload.messages)");
    expect(switcher).toContain("if (epoch === agentContextEpochRef.current)");
    expect(switcher).toContain("setAgentSwitchNotice(");
    expect(source).toContain("disabled={voiceOpen || busy || agentSwitchBusy || newChatBusy || composeBusy || mailPermissionBusy}");
    expect(source).toContain("if (agentSwitchInFlightRef.current) return;");
  });

  it("discards stale voice refreshes instead of replacing the newly selected agent history", () => {
    expect(voiceReturn).toContain("const epoch = agentContextEpochRef.current");
    expect(voiceReturn).toContain("if (epoch !== agentContextEpochRef.current) return;");
    expect(voiceReturn).toContain("message.conversationId === data.conversation?.id");
  });

  it("ties mailbox setup, draft saving and approval to the original review revision", () => {
    expect(setup).toContain("const revision = ++composeRevisionRef.current");
    expect(setup).toContain("revision !== composeRevisionRef.current || epoch !== agentContextEpochRef.current");
    expect(submit).toContain("const revision = composeRevisionRef.current");
    expect(submit).toContain("revision !== composeRevisionRef.current || epoch !== agentContextEpochRef.current");
    expect(submit).toContain("composeInFlightRef.current = true");
    expect(submit).toContain("composeInFlightRef.current = false");
    expect(submit).toContain('data.status !== "draft_created"');
    expect(submit).toContain('data.status !== "pending_approval"');
    expect(submit).toContain("setComposeDraftId(data.draftId)");
    expect(submit).toContain("setComposeActionId(data.actionId)");
  });

  it("invalidates old draft and approval identifiers on any editable field change", () => {
    expect(source).toContain("function invalidateComposeReview()");
    expect(source).toContain("composeRevisionRef.current += 1");
    expect(source).toContain("setComposeDraftId(null)");
    expect(source).toContain("setComposeActionId(null)");
    expect(composeUI.match(/invalidateComposeReview\(\)/g)).toHaveLength(4);
    expect(composeUI.match(/disabled=\{composeBusy\}/g)).toHaveLength(4);
    expect(source).toContain('if (mailComposerOpen) { composeRevisionRef.current += 1; setMailComposerOpen(false); }');
  });
});
