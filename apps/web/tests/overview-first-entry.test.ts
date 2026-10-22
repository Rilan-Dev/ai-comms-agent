import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(__dirname, "../src", path), "utf8");

describe("Owner-requested Overview-first entry", () => {
  it("redirects the authenticated root to Overview while preserving direct Chat", () => {
    const home = source("app/page.tsx");
    const chat = source("app/chat/page.tsx");
    expect(home).toContain('redirect("/overview")');
    expect(home).not.toContain('from "./chat/page"');
    expect(chat).toContain("export default async function ChatPage");
  });

  it("makes Overview the first navigation item and leaves Chat reachable", () => {
    const sidebar = source("components/sidebar.tsx");
    const overview = sidebar.indexOf('{ label: "Overview", href: "/overview"');
    const chat = sidebar.indexOf('{ label: "Chat", href: "/chat"');
    const mail = sidebar.indexOf('{ label: "Mail", href: "/mail/inbox"');
    expect(overview).toBeGreaterThan(-1);
    expect(chat).toBeGreaterThan(overview);
    expect(mail).toBeGreaterThan(chat);
    expect(sidebar).toContain('<a href="/overview"');
  });

  it("only offers a catch-up preview when the server enables it", () => {
    const api = source("app/api/overview/route.ts");
    const overview = source("app/overview/page.tsx");
    expect(api).toContain('import { briefingsEnabled } from "@/lib/briefings/config"');
    expect(api).toContain("catchUpAvailable: briefingsEnabled()");
    expect(overview).toContain("catchUpAvailable: boolean");
    expect(overview).toContain("data?.catchUpAvailable");
    expect(overview).toContain('href="/catch-up"');
    expect(overview).toContain("Opening Overview does not mark messages as read or reviewed");
  });

  it("offers existing, honest entry points for checking, asking, and scheduling", () => {
    const overview = source("app/overview/page.tsx");
    expect(overview).toContain('href="/mail/inbox"');
    expect(overview).toContain('href="/chat"');
    expect(overview).toContain('href="/schedules"');
    expect(overview).toContain('href="/automations"');
    expect(overview).toContain("organization-wide");
  });
});
