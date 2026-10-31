import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const topBar = readFileSync(new URL("../src/components/top-bar.tsx", import.meta.url), "utf8");

const segment = (start: string, end: string) => {
  const from = chat.indexOf(start);
  const to = chat.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error("Chat layout marker missing: " + start);
  return chat.slice(from, to);
};

describe("conversation sidebar and persistent controls", () => {
  it("constrains the Chat workspace to the viewport below the existing 64px application bar", () => {
    expect(topBar).toContain("h-[64px]");
    expect(shell).toContain("<TopBar workspaceName={workspaceName} organizationName={organization?.name ?? null} />");
    expect(chat).toContain('h-[calc(100dvh-64px)] min-h-0 min-w-0 flex-col overflow-hidden');
    expect(chat).toContain('relative z-10 shrink-0 border-b');
    expect(chat).toContain('relative flex min-h-0 flex-1 overflow-hidden');
    expect(chat).toContain('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden');
  });

  it("keeps agent name, compose, permissions, voice and agent switch outside the scrolling message pane", () => {
    const header = segment('<header className=', "</header>");
    const messageLog = segment('ref={messageScrollRef} role="log"', '</div>\n\n        <div className="shrink-0 bg-background');
    for (const control of [
      "activeAgent?.name", 'aria-label="Choose agent"', 'Open live realtime voice conversation',
    ]) expect(header).toContain(control);
    for (const control of ['aria-label="Choose agent"']) {
      expect(messageLog).not.toContain(control);
    }
    expect(chat).toContain('aria-label="Email review in this Chat conversation"');
    expect(chat).toContain('className="shrink-0 bg-background pb-4 pt-2"');
  });

  it("scrolls messages separately without causing the whole page to scroll into view", () => {
    expect(chat).toContain('ref={messageScrollRef} role="log"');
    expect(chat).toContain("min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain");
    expect(chat).toContain("pane.scrollTo({ top: pane.scrollHeight, behavior: \"smooth\" })");
    expect(chat).not.toContain("bottomRef.current?.scrollIntoView");
    expect(chat).not.toContain('flex-1 gap-2 overflow-x-auto pb-1');
  });

  it("places New chat above an independently scrolling vertical conversation list", () => {
    const sidebar = segment('<aside ref={historySidebarRef}', "</aside>");
    expect(sidebar).toContain('aria-label="Chat history"');
    expect(sidebar).toContain('aria-label="Recent conversations"');
    expect(sidebar).toContain("+ New chat");
    expect(sidebar).toContain('className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain');
    expect(sidebar).toContain('session.subject || "Untitled chat"');
    expect(sidebar).toContain('aria-current={session.id === conversationId ? "page" : undefined}');
    expect(sidebar).toContain("new URLSearchParams({ agentId, conversationId: session.id })");
    expect(sidebar).toContain("Open this chat and discard your unsent message?");
    expect(sidebar).not.toContain("overflow-x-auto");
    expect(chat.indexOf('<aside ref={historySidebarRef}')).toBeLessThan(chat.indexOf('role="log"'));
  });

  it("hides the conversation list by default on both desktop and mobile, with accessible on-demand dialog", () => {
    expect(chat).toContain('const [chatHistoryOpen, setChatHistoryOpen] = useState(false)');
    expect(chat).toContain('aria-label="Show conversations"');
    expect(chat).toContain('aria-controls="chat-conversation-sidebar"');
    expect(chat).toContain('aria-expanded={chatHistoryOpen}');
    expect(chat).toContain('aria-label="Close conversations"');
    expect(chat).toContain('aria-label="Dismiss conversation history"');
    expect(chat).toContain('chatHistoryOpen ? "flex" : "hidden"');
    expect(chat).not.toContain('lg:relative lg:inset-auto lg:z-auto lg:flex');
    expect(chat).not.toContain('hover:bg-secondary lg:hidden');
    expect(chat).toContain('role={chatHistoryOpen ? "dialog" : undefined}');
    expect(chat).toContain('aria-modal={chatHistoryOpen ? true : undefined}');
    expect(chat).toContain('if (event.key === "Escape")');
    expect(chat).toContain('if (event.key !== "Tab") return;');
    expect(chat).toContain('historyTriggerRef.current?.focus()');
    expect(chat).toContain('historyCloseRef.current?.focus()');
  });

  it("preserves existing conversation, permissions and voice safety semantics", () => {
    expect(chat).toContain("if (draft.trim() && !window.confirm");
    expect(chat).toContain('method: "POST", headers: { "content-type": "application/json" }');
    expect(chat).toContain('window.location.assign("/chat?"');
    expect(chat).toContain('new URLSearchParams({ organizationId, agentId, conversationId })');
    expect(chat).toContain("setMailPermissionOpen(false)");
    expect(chat).toContain("composeRevisionRef.current += 1");
    expect(chat).toContain("voiceOpen ? (");
    expect(chat).toContain("embedded onReturnToChat");
  });
});
