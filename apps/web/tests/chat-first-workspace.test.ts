import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

describe("chat-first workspace navigation", () => {
  it("renders Chat on the main route without losing Overview", () => {
    const home = read("../src/app/page.tsx");
    const overview = read("../src/app/overview/page.tsx");
    expect(home).toContain('from "./chat/page"');
    expect(overview).toContain("Workspace snapshot");
  });

  it("places Chat first and expands Mail folders on every route by default", () => {
    const nav = read("../src/components/sidebar.tsx");
    expect(nav.indexOf('label: "Chat"')).toBeLessThan(nav.indexOf('label: "Overview"'));
    expect(nav.indexOf('label: "Overview"')).toBeLessThan(nav.indexOf('label: "Mail"'));
    for (const item of ["Inbox", "Drafts", "Threads", "Accounts"]) expect(nav).toContain(`label: "${item}"`);
    expect(nav).toContain("useState(true)");
    expect(nav).toContain('aria-controls="mail-navigation"');
    expect(nav).toContain("mailExpanded && <ul");
    expect(nav).toContain("aria-expanded={mailExpanded}");
  });

  it("has exactly one desktop sidebar offset owned by root content shell", () => {
    const layout = read("../src/app/layout.tsx");
    const topBar = read("../src/components/top-bar.tsx");
    expect(layout).toContain("md:ml-[248px]");
    expect(topBar).not.toContain("md:ml-[248px]");
    expect(topBar).toContain("sticky top-0");
  });
});

describe("realtime voice inside Chat", () => {
  it("dynamically mounts the existing voice component only by user action", () => {
    const chat = read("../src/app/chat/chat-client.tsx");
    expect(chat).toContain("import dynamic from");
    expect(chat).toContain('import("../ai-voice/voice-workspace")');
    expect(chat).toContain("onClick={() => setVoiceOpen(true)}");
    expect(chat).toContain("voiceOpen ? (");
    expect(chat).toContain("embedded onReturnToChat");
    expect(chat).not.toContain('href="/ai-voice"');
  });

  it("cannot unmount an active voice session via the Chat header toggle", () => {
    const chat = read("../src/app/chat/chat-client.tsx");
    const voice = read("../src/app/ai-voice/voice-workspace.tsx");
    expect(chat).toContain("disabled={busy || voiceOpen}");
    expect(chat).not.toContain("setVoiceOpen((open) => !open)");
    expect(voice).toContain("if (liveSession)");
    expect(voice).toContain("endSession()");
    expect(voice).toContain("onReturnToChat");
  });
});

describe("HTML inbox reader isolation", () => {
  it("keeps message HTML out of the app DOM and in an opaque frame", () => {
    const reader = read("../src/app/mail/thread/[threadId]/thread-client.tsx");
    expect(reader).toContain('sandbox=""');
    expect(reader).toContain('referrerPolicy="no-referrer"');
    expect(reader).toContain("buildEmailPreviewDocument(htmlBody)");
    expect(reader).toContain("Expand preview");
    expect(reader).not.toContain("dangerouslySetInnerHTML");
  });
});
