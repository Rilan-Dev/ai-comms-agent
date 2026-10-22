import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const client = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
const section = (start: string, end: string) => {
  const a = client.indexOf(start), b = client.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error("ChatClient function marker missing: " + start);
  return client.slice(a, b);
};
const send = section("async function sendMessage()", "return (");
const newChat = section("async function startNewChat()", "async function returnFromVoice()");
const changeAgent = section("async function switchAgent(", "async function startNewChat()");
const recentChats = section("{conversations.map(session => (", "{conversations.length === 0");

describe("FIX-01: chat turn and navigation cannot race before React busy state renders", () => {
  it("acquires a synchronous turn lock before clearing a draft or submitting the network request", () => {
    expect(client).toContain("const chatTurnInFlightRef = useRef(false)");
    const guard = send.indexOf("if (chatTurnInFlightRef.current || newChatInFlightRef.current");
    const claim = send.indexOf("chatTurnInFlightRef.current = true");
    const clearDraft = send.indexOf('setDraft("")');
    const fetchTurn = send.indexOf('fetch("/api/chat/stream"');
    expect(guard).toBeGreaterThan(0);
    expect(claim).toBeGreaterThan(guard);
    expect(claim).toBeLessThan(clearDraft);
    expect(clearDraft).toBeLessThan(fetchTurn);
  });

  it("rejects a second send even when the state-based busy flag has not rendered", () => {
    expect(send).toContain("chatTurnInFlightRef.current");
    expect(send).toContain("if (!content || busy || newChatBusy");
    expect(send.indexOf("chatTurnInFlightRef.current = true")).toBeLessThan(send.indexOf("setBusy(true)"));
  });

  it("releases the turn lock on success, thrown errors and prematurely closed streams", () => {
    expect(send).toContain("if (!completed) throw new Error");
    expect(send).toContain("} catch (error) {");
    const finallyBlock = send.slice(send.indexOf("} finally {"));
    expect(finallyBlock).toContain("chatTurnInFlightRef.current = false");
    expect(finallyBlock).toContain("setBusy(false)");
  });

  it("never starts another session or changes agents while a turn is being submitted", () => {
    expect(newChat).toContain("chatTurnInFlightRef.current");
    expect(newChat).toContain("newChatInFlightRef.current = true");
    expect(changeAgent).toContain("chatTurnInFlightRef.current");
    expect(changeAgent).toContain("agentSwitchInFlightRef.current = true");
  });

  it("blocks a recent-chat link on the same synchronous guard even before rerender", () => {
    expect(recentChats).toContain("event.preventDefault(); return;");
    expect(recentChats).toContain("chatTurnInFlightRef.current");
    expect(recentChats).toContain("newChatInFlightRef.current");
  });

  it("preserves existing tenant/agent/conversation IDs and server host-tool permission checks", () => {
    expect(send).toContain("organizationId, agentId: activeAgent.id, conversationId, message: content");
    expect(newChat).toContain("agentId: activeAgent.id");
    expect(changeAgent).toContain("const epoch = ++agentContextEpochRef.current");
    expect(send).toContain('fetch("/api/chat/stream"');
    expect(send).not.toContain('fetch("/api/chat/mail-compose"');
  });
});
