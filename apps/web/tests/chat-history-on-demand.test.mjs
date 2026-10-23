import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
const sidebar = chat.slice(chat.indexOf('<aside ref={historySidebarRef}'), chat.indexOf('</aside>', chat.indexOf('<aside ref={historySidebarRef}')));

test("previous conversations stay closed by default on mobile AND desktop", () => {
  assert.match(chat, /const \[chatHistoryOpen, setChatHistoryOpen\] = useState\(false\)/);
  assert.match(sidebar, /chatHistoryOpen \? "flex" : "hidden"/);
  assert.doesNotMatch(sidebar, /lg:flex|lg:block|xl:flex/);
  assert.match(sidebar, /absolute/);
  assert.match(sidebar, /z-30/);
  assert.match(sidebar, /max-w-sm|sm:w-80/);
  assert.match(chat, /relative flex min-h-0 flex-1 overflow-hidden/);
});

test("Chats control remains available at desktop widths to show saved sessions only on demand", () => {
  const header = chat.slice(chat.indexOf("<header"), chat.indexOf("</header>"));
  const control = header.slice(header.indexOf("ref={historyTriggerRef}"), header.indexOf("</button>", header.indexOf("ref={historyTriggerRef}")));
  assert.ok(control.includes('aria-label="Show conversations"'));
  assert.ok(control.includes('aria-controls="chat-conversation-sidebar"'));
  assert.ok(control.includes('aria-expanded={chatHistoryOpen}'));
  assert.ok(control.includes("setChatHistoryOpen(true)"));
  assert.doesNotMatch(control, /lg:hidden|md:hidden|sm:hidden/);
});

test("history drawer is dismissible on all screens with Close, Escape, or outside tap", () => {
  assert.match(sidebar, /role=\{chatHistoryOpen \? "dialog" : undefined\}/);
  assert.match(sidebar, /aria-modal=\{chatHistoryOpen \? true : undefined\}/);
  assert.match(sidebar, /aria-label="Close conversations"/);
  assert.doesNotMatch(sidebar, /lg:hidden/);
  assert.match(chat, /aria-label="Dismiss conversation history"/);
  assert.match(chat, /onClick=\{\(\) => setChatHistoryOpen\(false\)\}/);
  assert.match(chat, /if \(event.key === "Escape"\)/);
  assert.match(chat, /historyTriggerRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(chat, /event\.key !== "Tab" \|\| window\.matchMedia/);
});

test("the active conversation is not replaced by the history toggle", () => {
  assert.match(sidebar, /conversations\.map\(session =>/);
  assert.match(sidebar, /session\.id === conversationId \? "page" : undefined/);
  assert.match(sidebar, /new URLSearchParams\(\{ agentId, conversationId: session\.id \}\)/);
  assert.match(chat, /role="log"/);
  assert.match(sidebar, /session\.id !== conversationId && draft\.trim\(\)[\s\S]*?window\.confirm\("Open this chat and discard your unsent message\?"\)/);
});
