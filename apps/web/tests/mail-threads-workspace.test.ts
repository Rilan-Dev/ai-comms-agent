import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");
const repository = read("../../../packages/db/src/email/repository.ts");
const exported = read("../../../packages/db/src/index.ts");
const page = read("../src/app/mail/threads/page.tsx");
const client = read("../src/app/mail/threads/threads-client.tsx");
const api = read("../src/app/api/mail/threads/route.ts");

describe("persisted Mail Threads — tenant scoped source contracts", () => {
  it("no longer renders placeholder demo copy and loads real threads using authenticated context", () => {
    expect(page).toContain("getAuthenticatedAppContext");
    expect(page).toContain("listMailThreadsForOrganization(organizationId");
    expect(page).toContain("PostgresEmailAccountRepository().listForOrganization(organizationId)");
    expect(page).toContain("<ThreadsClient");
    expect(page).not.toContain("No live mailbox connected");
    expect(page).not.toContain("getDevOrgId");
    expect(page).toContain('headers: await headers()');
    expect(page).toContain("if (!context?.organizationId)");
    expect(page).not.toContain("aca-access-token");
  });

  it("joins messages to thread and account by the same organization and mailbox", () => {
    const block = repository.slice(repository.indexOf("export async function listMailThreadsForOrganization("));
    expect(block).toContain("a.organization_id = $1 AND a.deleted_at IS NULL");
    expect(block).toContain("t.organization_id = $1 AND t.email_account_id = a.id");
    expect(block).toContain("m.organization_id = $1");
    expect(block).toContain("($2::uuid IS NULL OR m.email_account_id = $2::uuid)");
    expect(block).toContain("PARTITION BY m.thread_id");
    expect(block).toContain("NOT m.is_read AND NOT m.is_draft AND NOT m.is_sent");
    expect(block).toContain("ILIKE '%' || $3 || '%'");
    expect(block).toContain("LIMIT $5 OFFSET $6");
    expect(block).not.toContain("SELECT m.*");
  });

  it("does not hand HTML, secrets or raw message bodies to conversation summaries", () => {
    const block = repository.slice(repository.indexOf("export async function listMailThreadsForOrganization("));
    const sql = block.slice(block.indexOf("WITH scoped AS"), block.indexOf("`,\n    [organizationId"));
    expect(sql).not.toContain("m.html_body_sanitized");
    expect(sql).not.toContain("m.connection_config");
    expect(sql).not.toContain("SELECT m.*");
    expect(exported).toContain("listMailThreadsForOrganization,");
  });

  it("checks organization permissions before querying and validates limit/account filters", () => {
    expect(api).toContain("await authorize(request");
    expect(api).toContain('permission: "email.read"');
    expect(api.indexOf("await authorize(request")).toBeLessThan(api.indexOf("await listMailThreadsForOrganization"));
    expect(api).toContain("limit > 50");
    expect(api).toContain("offset > 10000");
    expect(api).toContain("search.length > 120");
    expect(api).toContain('Cache-Control": "private, no-store"');
    expect(api).toContain("authorizationErrorToResponse");
  });
});

describe("Mail Threads interaction and realtime Chat usability", () => {
  it("offers search, account filtering, unread-only, real links, pagination and accessible errors", () => {
    expect(client).toContain('role="search"');
    expect(client).toContain('aria-label="Filter by mailbox"');
    expect(client).toContain("Unread conversations only");
    expect(client).toContain("thread.unread_count");
    expect(client).toContain("thread.message_count");
    expect(client).toContain("Load more conversations");
    expect(client).toContain('href={`/mail/thread/${encodeURIComponent(thread.thread_id)}`}');
    expect(client).toContain('role="alert"');
    expect(client).toContain('aria-busy={loading}');
  });

  it("aborts old requests before applying a newly selected mailbox", () => {
    expect(client).toContain("inflight.current?.abort()");
    expect(client).toContain("new AbortController()");
    expect(client).toContain("if (controller.signal.aborted) return;");
    expect(client).toContain("setThreads([])");
    expect(client).toContain("setHasMore(false)");
    expect(client).toContain("Threads could not be loaded. Use Retry to try again.");
  });

  it("restores keyboard focus after returning from a live conversation without losing the chat draft", () => {
    const chat = read("../src/app/chat/chat-client.tsx");
    expect(chat).toContain("const voiceWasOpen = useRef(false)");
    expect(chat).toContain("composerRef.current?.focus()");
    expect(chat).toContain("ref={composerRef}");
    expect(chat).toContain("setVoiceOpen(true)");
    expect(chat).toContain('onReturnToChat={() => setVoiceOpen(false)}');
    expect(chat).toContain("flex-wrap items-center justify-between");
  });
});
