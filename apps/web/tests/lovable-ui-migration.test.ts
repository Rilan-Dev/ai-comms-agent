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
const draftsPage = readFileSync(resolve(__dirname, "../src/app/mail/drafts/page.tsx"), "utf8");
const compose = readFileSync(resolve(__dirname, "../src/app/mail/compose/compose-client.tsx"), "utf8");
const threads = readFileSync(resolve(__dirname, "../src/app/mail/threads/page.tsx"), "utf8");
const accounts = readFileSync(resolve(__dirname, "../src/app/mail/accounts/email-accounts-client.tsx"), "utf8");
const approvals = readFileSync(resolve(__dirname, "../src/app/mail/approvals/approvals-client.tsx"), "utf8");
const whatsappPage = readFileSync(resolve(__dirname, "../src/app/whatsapp/page.tsx"), "utf8");
const whatsapp = readFileSync(resolve(__dirname, "../src/app/whatsapp/whatsapp-client.tsx"), "utf8");
const automations = readFileSync(resolve(__dirname, "../src/app/automations/automations-client.tsx"), "utf8");
const schedules = readFileSync(resolve(__dirname, "../src/app/schedules/schedules-client.tsx"), "utf8");
const chat = readFileSync(resolve(__dirname, "../src/app/chat/chat-client.tsx"), "utf8");
const voice = readFileSync(resolve(__dirname, "../src/app/ai-voice/voice-workspace.tsx"), "utf8");
const knowledge = readFileSync(resolve(__dirname, "../src/app/knowledge/page.tsx"), "utf8");
const knowledgeApi = readFileSync(resolve(__dirname, "../src/app/api/knowledge/route.ts"), "utf8");

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
    expect(draftsPage).toContain("font-display");
    expect(drafts).toContain("filteredDrafts");
    expect(drafts).toContain("provider_draft_sync_status");
    expect(drafts).toContain('href={"/mail/compose?draftId="');
    expect(drafts).toContain("Delete");
  });

  it("keeps mailbox connection forms and account operations while using the Lovable visual system", () => {
    expect(accounts).toContain("font-display");
    expect(accounts).toContain('type="email"');
    expect(accounts).toContain('type="password"');
    expect(accounts).toContain("Test connection");
    expect(accounts).toContain("Save mailbox");
    expect(accounts).toContain("Disconnect");
    expect(accounts).toContain("Remove");
    expect(accounts).toContain("Search mailboxes");
  });

  it("keeps explicit approval decisions and the truthful empty queue in the Lovable style", () => {
    expect(approvals).toContain("font-display");
    expect(approvals).toContain('decision: "approved" | "rejected"');
    expect(approvals).toContain('decide(a.id,"approved")');
    expect(approvals).toContain('decide(a.id,"rejected")');
    expect(approvals).toContain("Nothing waiting for approval");
    expect(approvals).toContain("No provider action was executed.");
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
  it("routes WhatsApp through the authenticated organization and makes Connect open the real setup form", () => {
    expect(whatsappPage).toContain("getAuthenticatedAppContext");
    expect(whatsappPage).toContain("context.organizationId");
    expect(whatsappPage).not.toContain("getDevOrgId");
    expect(whatsapp).toContain('aria-controls="whatsapp-connect-form"');
    expect(whatsapp).toContain('id="whatsapp-connect-form"');
    expect(whatsapp).toContain("setShowConnectForm(v => !v)");
    expect(whatsapp).toContain("Save and connect");
    expect(whatsapp).toContain("does not claim a successful Meta verification");
  });

  it("adapts WhatsApp to the Lovable design while preserving secure account and idempotent send flows", () => {
    expect(whatsapp).toContain('from "lucide-react"');
    expect(whatsapp).toContain('font-display text-3xl');
    expect(whatsapp).toContain('"/api/whatsapp/accounts"');
    expect(whatsapp).toContain('"/api/whatsapp/messages"');
    expect(whatsapp).toContain('"Idempotency-Key": idempotencyKey');
    expect(whatsapp).toContain('type={secret ? "password" : "text"}');
    expect(whatsapp).toContain("credentials were encrypted and stored");
    expect(whatsapp).toContain("No persisted messages yet.");
  });

  it("keeps automation creation/archive and schedule recurrence/timezone controls in the Lovable theme", () => {
    expect(automations).toContain('"/api/organizations/"+organizationId+"/automations"');
    expect(automations).toContain("Create rule");
    expect(automations).toContain("Archive");
    expect(automations).toContain("rounded-md");
    expect(schedules).toContain('"/api/organizations/" + organizationId + "/schedules"');
    expect(schedules).toContain('aria-label="Cron expression"');
    expect(schedules).toContain('aria-label="One-time fire time"');
    expect(schedules).toContain("timezone");
    expect(schedules).toContain("lastError");
    expect(schedules).toContain("No schedules yet.");
  });
  it("keeps Clara chat connected to the authenticated streaming API with Lovable iconography", () => {
    expect(chat).toContain('from "lucide-react"');
    expect(chat).toContain("Sparkles");
    expect(chat).toContain("AudioLines");
    expect(chat).toContain('fetch("/api/chat/stream"');
    expect(chat).toContain("organizationId, agentId: activeAgent.id, conversationId, message: content");
    expect(chat).toContain("Enter to send · Shift+Enter for a new line");
    expect(chat).toContain("Clara is thinking…");
    expect(chat).toContain('href="/ai-voice"');
  });
  it("shows real organization-scoped Clara knowledge status instead of hard-coded counts", () => {
    expect(knowledge).toContain('fetch("/api/knowledge"');
    expect(knowledge).toContain("Recent email knowledge");
    expect(knowledge).toContain("No email knowledge yet");
    expect(knowledge).toContain('href="/mail/accounts"');
    expect(knowledge).toContain("semantic embeddings or Qdrant indexing");
    expect(knowledge).not.toContain("0 indexed");
    expect(knowledgeApi).toContain('permission: "organization.read"');
    expect(knowledgeApi).toContain("WHERE organization_id=$1");
    expect(knowledgeApi).toContain("knowledge_chunks");
    expect(knowledgeApi).toContain("recentDocuments");
  });
  it("adapts realtime voice visuals without changing Clara-owned session and safety boundaries", () => {
    expect(voice).toContain('from "lucide-react"');
    expect(voice).toContain("AudioLines");
    expect(voice).toContain("isCurrentVoiceSequence");
    expect(voice).toContain('fetch("/api/voice/session"');
    expect(voice).toContain("Server-side only");
    expect(voice).toContain("Voice-originated business actions continue through the same authorization and approval boundary");
    expect(voice).toContain("Microphone access was denied");
    expect(voice).toContain("End session");
  });
});
