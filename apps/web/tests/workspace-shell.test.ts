import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relative: string) =>
  readFileSync(resolve(__dirname, "../src", relative), "utf8");

describe("Overview-first workspace navigation", () => {
  it("makes Overview the home page while retaining the /chat route", () => {
    const home = source("app/page.tsx");
    const overview = source("app/overview/page.tsx");
    const chatPage = source("app/chat/page.tsx");
    expect(home).toContain('redirect("/overview")');
    expect(home).not.toContain('from "./chat/page"');
    expect(overview).toContain("export default function HomePage");
    expect(chatPage).toContain("export default async function ChatPage");
  });

  it("puts Overview first, keeps Chat direct and defaults Mail open", () => {
    const sidebar = source("components/sidebar.tsx");
    const overview = sidebar.indexOf('{ label: "Overview", href: "/overview"');
    const chat = sidebar.indexOf('{ label: "Chat", href: "/chat"');
    const mail = sidebar.indexOf('{ label: "Mail", href: "/mail/inbox"');
    expect(overview).toBeGreaterThan(-1);
    expect(chat).toBeGreaterThan(overview);
    expect(mail).toBeGreaterThan(chat);
    expect(sidebar).toContain("useState(true)");
    expect(sidebar).toContain('aria-expanded={mailExpanded}');
    expect(sidebar).toContain('aria-controls="mail-navigation"');
    expect(sidebar).toContain('href: "/mail/inbox"');
    expect(sidebar).toContain('href: "/mail/drafts"');
    expect(sidebar).toContain('href: "/mail/threads"');
    expect(sidebar).not.toContain('{ label: "AI & Voice", href: "/ai-voice"');
  });

  it("applies the 248px desktop sidebar offset exactly once", () => {
    const layout = source("app/layout.tsx");
    const header = source("components/top-bar.tsx");
    expect(layout).toContain("md:ml-[248px]");
    expect(header).not.toContain("md:ml-[248px]");
  });
});

describe("Embedded realtime voice in the chat workspace", () => {
  it("opens voice from both the chat header and composer without route navigation", () => {
    const chat = source("app/chat/chat-client.tsx");
    expect(chat).toContain('import dynamic from "next/dynamic"');
    expect(chat).toContain('import("../ai-voice/voice-workspace")');
    expect(chat).toContain("setVoiceOpen(true)");
    expect(chat).toContain('initialAgentId={agentId}');
    // Returning from voice must refresh the current agent's persisted chat
    // session, rather than closing the component and silently losing turns.
    expect(chat).toContain("embedded onReturnToChat={() => { void returnFromVoice(); }}");
    expect(chat).toContain("async function returnFromVoice()");
    expect(chat).toContain("setVoiceOpen(false)");
    expect(chat).not.toContain("onReturnToChat={() => setVoiceOpen(false)}");
    expect(chat).not.toContain('href="/ai-voice"');
  });

  it("reuses one voice transport with agent binding, cleanup and explicit exit", () => {
    const voice = source("app/ai-voice/voice-workspace.tsx");
    expect(voice).toContain("initialAgentId?: string");
    expect(voice).toContain("embedded?: boolean");
    expect(voice).toContain("Back to chat");
    expect(voice).toContain('method: "DELETE"');
    expect(voice).toContain("stopMedia()");
    expect(voice).toContain("sessionRef.current");
  });
});

describe("Mail thread reader", () => {
  it("returns the stored HTML body alias to the tenant-scoped thread UI", () => {
    const db = readFileSync(resolve(__dirname, "../../../packages/db/src/email/repository.ts"), "utf8");
    const section = db.slice(db.indexOf("export async function getMailThreadForOrganization("));
    expect(section).toContain("m.html_body_sanitized AS html_body");
    expect(section).toContain("a.organization_id = $2");
  });

  it("renders email inside an opaque sandbox and keeps plaintext fallback", () => {
    const reader = source("app/mail/thread/[threadId]/thread-client.tsx");
    expect(reader).toContain('sandbox=""');
    expect(reader).toContain('referrerPolicy="no-referrer"');
    expect(reader).toContain("buildEmailPreviewDocument(htmlBody)");
    expect(reader).toContain('mode === "html"');
    expect(reader).toContain("m.text_body");
    expect(reader).not.toContain("dangerouslySetInnerHTML");
  });
});
