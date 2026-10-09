import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../src/app/globals.css"), "utf8");
const layout = readFileSync(resolve(__dirname, "../src/app/layout.tsx"), "utf8");
const sidebar = readFileSync(resolve(__dirname, "../src/components/sidebar.tsx"), "utf8");
const topBar = readFileSync(resolve(__dirname, "../src/components/top-bar.tsx"), "utf8");
const overview = readFileSync(resolve(__dirname, "../src/app/page.tsx"), "utf8");
const inbox = readFileSync(resolve(__dirname, "../src/app/mail/inbox/inbox-client.tsx"), "utf8");
const login = readFileSync(resolve(__dirname, "../src/app/login/page.tsx"), "utf8");
const agents = readFileSync(resolve(__dirname, "../src/app/agents/agents-client.tsx"), "utf8");
const drafts = readFileSync(resolve(__dirname, "../src/app/mail/drafts/drafts-client.tsx"), "utf8");
const compose = readFileSync(resolve(__dirname, "../src/app/mail/compose/compose-client.tsx"), "utf8");
const threads = readFileSync(resolve(__dirname, "../src/app/mail/threads/page.tsx"), "utf8");

describe("Lovable Agentic AI Studio UI adaptation", () => {
  it("uses the Lovable semantic palette and typography without replacing Tailwind tokens", () => {
    expect(css).toContain("--background: oklch(0.985 0.004 80)");
    expect(css).toContain("--accent: oklch(0.88 0.105 152)");
    expect(css).toContain("DM Sans");
    expect(css).toContain("Space Grotesk");
    expect(css).toContain("--color-background: var(--background)");
  });

  it("preserves the Next.js authenticated shell while aligning the responsive workspace sidebar", () => {
    expect(layout).toContain("getAuthenticatedAppContext(request)");
    expect(layout).toContain("redirect(\"/login?reason=not_provisioned\")");
    expect(layout).toContain("md:ml-[248px]");
    expect(sidebar).toContain('href: "/agents"');
    expect(sidebar).toContain('href: "/mail/accounts"');
    expect(sidebar).toContain("item.children?.some");
    expect(sidebar).toContain('href: "/ai-voice"');
    expect(sidebar).toContain("setMobileOpen(true)");
    expect(sidebar).toContain("/api/auth/logout");
  });

  it("uses inline agent iconography and Lovable compact geometry without changing persisted create/validation flows", () => {
    expect(agents).toContain("function AgentMark");
    expect(agents).toContain("slugifyAgentName(name)");
    expect(agents).toContain("router.push(");
    expect(agents).toContain('pattern="[a-z0-9]+(?:-[a-z0-9]+)*"');
    expect(agents).toContain("maxLength={500}");
    expect(agents).toContain("font-display");
    expect(agents).toContain("border-border");
  });

  it("adapts the persisted inbox to the Lovable visual language without removing mail actions", () => {
    expect(inbox).toContain("font-display");
    expect(inbox).toContain("All conversations");
    expect(inbox).toContain('fetch("/api/mail/inbox?"');
    expect(inbox).toContain('fetch("/api/mail/messages/read-state"');
    expect(inbox).toContain('folderAction(m.id,"archive")');
    expect(inbox).toContain('folderAction(m.id,"move",value)');
    expect(inbox).toContain('href="/mail/compose"');
    expect(inbox).toContain('href="/mail/approvals"');
    expect(inbox).toContain('href="/mail/accounts"');
    expect(inbox).toContain('role="alert"');
    expect(inbox).toContain("Your inbox is empty");
  });

  it("keeps workspace search connected to the real Inbox query state", () => {
    expect(topBar).toContain('action="/mail/inbox"');
    expect(topBar).toContain('name="q"');
    expect(inbox).toContain('searchParams.get("q")');
    expect(inbox).toContain('params.set("q", q.trim())');
    expect(inbox).toContain('fetch("/api/mail/inbox?"');
  });

  it("keeps the overview backed by persisted API data and truthful loading/error states", () => {
    expect(overview).toContain('fetch("/api/overview")');
    expect(overview).toContain("Workspace data unavailable");
    expect(overview).toContain("No activity has been recorded yet.");
    expect(overview).not.toContain("Across connected previews");
  });

  it("keeps Drafts discoverability and provider-sync actions while applying the shared design", () => {
    expect(drafts).toContain("font-display");
    expect(drafts).toContain("filteredDrafts");
    expect(drafts).toContain("provider_draft_sync_status");
    expect(drafts).toContain('href={"/mail/compose?draftId="');
    expect(drafts).toContain("Delete");
  });

  it("keeps Compose approval safeguards and gives Threads a consistent designed empty state", () => {
    expect(compose).toContain("Request send approval");
    expect(compose).toContain("Sending requires explicit approval");
    expect(compose).toContain("Save draft");
    expect(threads).toContain("font-display");
    expect(threads).toContain('href="/mail/accounts"');
    expect(threads).toContain("No live mailbox connected");
  });

  it("retains login validation and authenticated API behavior under the new visual palette", () => {
    expect(login).toContain('fetch("/api/auth/login"');
    expect(login).toContain('type="email"');
    expect(login).toContain('type="password"');
    expect(login).toContain("required");
    expect(login).toContain("setError");
    expect(login).toContain("window.location.replace");
  });
});
