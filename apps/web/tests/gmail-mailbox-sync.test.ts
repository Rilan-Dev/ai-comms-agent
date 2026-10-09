import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

describe("Gmail automatic mailbox synchronization", () => {
  it("starts the Gmail sync loop with the long-lived worker and stops it on shutdown", () => {
    const entry = read("../../../apps/worker/src/index.ts");
    expect(entry).toContain("startGmailMailboxSyncLoop");
    expect(entry).toContain("stopGmailMailboxSync()");
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
  });

  it("uses paginated initial sync before history-based incremental sync", () => {
    const adapter = read("../../../apps/worker/src/email/gmail-adapter.ts");
    expect(adapter).toContain("page.nextPageToken");
    expect(adapter).toContain("baselineHistoryId");
    expect(adapter).toContain("/history?startHistoryId=");
    expect(adapter).not.toContain('"/messages?maxResults=100&labelIds=INBOX"');
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
