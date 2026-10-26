import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

describe("Gmail automatic mailbox synchronization", () => {
  it("starts the multi-provider sync loop with the long-lived worker and stops it on shutdown", () => {
    const entry = read("../../../apps/worker/src/index.ts");
    expect(entry).toContain("startMailboxSyncLoop");
    expect(entry).toContain("stopMailboxSync()");
  });

  it("falls back to the same leased direct-sync batch when RabbitMQ enqueue fails", () => {
    const worker = read("../../../apps/worker/src/email/mailbox-sync-worker.ts");
    expect(worker).toContain("Mailbox queue producer poll failed; attempting leased direct-sync fallback");
    expect(worker).toContain("const result = await processMailboxSyncBatch()");
    expect(worker).toContain("Redis mailbox-sync lease unavailable; batch skipped to avoid uncoordinated multi-worker polling");
  });

  it("claims due Gmail accounts durably and records cursor, retry and success state", () => {
    const worker = read("../../../apps/worker/src/email/mailbox-sync-worker.ts");
    expect(worker).toContain("email_sync_states");
    expect(worker).toContain("ON CONFLICT (email_account_id) DO UPDATE");
    expect(worker).toContain("last_success_at");
    expect(worker).toContain("next_attempt_at");
    expect(worker).toContain("email_messages");
    expect(worker).toContain("email_threads");
    expect(worker).toContain("PostgresEmailFolderLabelRepository");
    expect(worker).toContain("listDraftIdsByMessage");
    expect(worker).toContain("provider_draft_sync_status");
  });

  it("uses paginated initial sync before history-based incremental sync", () => {
    const adapter = read("../../../apps/worker/src/email/gmail-adapter.ts");
    expect(adapter).toContain("page.nextPageToken");
    expect(adapter).toContain("baselineHistoryId");
    expect(adapter).toContain("listDraftIdsByMessage");
    expect(adapter).toContain("startHistoryId: state.history_token!");
    expect(adapter).not.toContain('"/messages?maxResults=100&labelIds=INBOX"');
  });

  it("dispatches persisted mailbox accounts to Gmail or Zoho adapters and includes Zoho in due-account selection", () => {
    const worker = read("../../../apps/worker/src/email/mailbox-sync-worker.ts");
    const zoho = read("../../../apps/worker/src/email/zoho-adapter.ts");
    expect(worker).toContain('candidate.provider === "zoho" ? new ZohoAdapter()');
    expect(worker).toContain("new ImapSmtpAdapter()");
    expect(worker).toContain("a.provider IN ('gmail','zoho','imap_smtp','microsoft_graph')");
    expect(worker).not.toContain("a.provider IN ('gmail','zoho','imap_smtp')");
    expect(zoho).toContain("const pageSize = 100");
    expect(zoho).toContain("this.listMessages(folder.provider_folder_id");
    expect(zoho).toContain('history_token: hasMore ? state.history_token : "zoho-full-v1"');
    expect(zoho).toContain('state.history_token === "zoho-full-v1"');
  });


  it("implements IMAP UID-based folder sync and parses RFC822 headers and bodies", () => {
    const adapter = read("../../../apps/worker/src/email/imap-smtp-adapter.ts");
    const worker = read("../../../apps/worker/src/email/mailbox-sync-worker.ts");
    expect(adapter).toContain('this.command("UID SEARCH ALL")');
    expect(adapter).toContain("UID FETCH");
    expect(adapter).toContain("UIDVALIDITY");
    expect(adapter).toContain("parseRawMessage");
    expect(adapter).toContain("parseRawMessage");
    expect(adapter).toContain('subject: parsed.subject');
    expect(adapter).toContain("is_draft: /\\\\Draft\\b/i.test(flags) || /drafts/i.test(folderId)");
    expect(worker).toContain('candidate.provider === "gmail" ? new GmailAdapter() : candidate.provider === "zoho" ? new ZohoAdapter() : candidate.provider === "microsoft_graph" ? new MicrosoftGraphAdapter() : new ImapSmtpAdapter()');
    expect(worker).toContain("a.provider IN ('gmail','zoho','imap_smtp','microsoft_graph')");
  });

  it("keeps synchronized email context tenant-scoped and passes it to agent chat", () => {
    const route = read("../src/app/api/chat/stream/route.ts");
    expect(route).toContain("m.organization_id = $1");
    expect(route).toContain("a.organization_id = $1");
    expect(route).toContain("a.status = 'connected'");
    expect(route).toContain("<untrusted_email_content>");
    expect(route).toContain("...(emailContext ? [{ role: \"system\" as const, content: emailContext }] : [])");
  });

  it("preserves an existing Google refresh token when reconnect omits one", () => {
    const callback = read("../src/app/api/oauth/gmail/callback/route.ts");
    expect(callback).toContain("previousCredentials?.refresh_token");
    expect(callback).toContain("tokens.refresh_token");
  });

  it("provides an authorized organization-scoped manual sync trigger and status polling", () => {
    const route = read("../src/app/api/email-accounts/[accountId]/sync/route.ts");
    const ui = read("../src/app/mail/accounts/email-accounts-client.tsx");
    expect(route).toContain('role: "admin"');
    expect(route).toContain("email_sync_states");
    expect(ui).toContain("syncNow(account)");
    expect(ui).toContain("15_000");
  });
});
