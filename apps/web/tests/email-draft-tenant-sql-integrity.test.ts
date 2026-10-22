import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const repo = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
function section(name: string, next: string) {
  const start = repo.indexOf("export async function " + name);
  const end = repo.indexOf("export async function " + next, start + name.length);
  if (start < 0 || end <= start) throw new Error("Missing draft repository section: " + name);
  return repo.slice(start, end);
}
const update = section("updateLocalDraftForOrganization", "listLocalDraftsForOrganization");
const pending = section("listDraftsPendingProviderSync", "markDraftProviderSyncingForOrganization");
const markSyncing = section("markDraftProviderSyncingForOrganization", "markDraftProviderSyncedForOrganization");
const markSynced = section("markDraftProviderSyncedForOrganization", "markDraftProviderSyncErrorForOrganization");
const markError = section("markDraftProviderSyncErrorForOrganization", "getLocalDraftForOrganization");
const get = section("getLocalDraftForOrganization", "markLocalDraftSentForOrganization");
const deletion = section("deleteLocalDraftForOrganization", "listMailThreadsForOrganization");

describe("FIX-01 email draft updates and sync enforce organization on both row and account", () => {
  it("requires same tenant for the draft row and bound account before any UPDATE", () => {
    expect(update).toContain("m.organization_id = ${values.length}");
    expect(update).toContain("a.organization_id = ${values.length}");
    expect(update).toContain("m.email_account_id = a.id");
    expect(update).toContain("m.is_draft = true");
    expect(update).toContain("a.deleted_at IS NULL");
    expect(update).toContain("RETURNING m.*");
  });
  it("never puts mismatched organization/account drafts on provider synchronization queue", () => {
    expect(pending).toContain("a.id = m.email_account_id");
    expect(pending).toContain("a.organization_id = m.organization_id");
    expect(pending).toContain("m.provider_draft_sync_status = 'syncing'");
    expect(pending).toContain("a.deleted_at IS NULL");
  });
  it("preserves existing organization predicates for every downstream draft transition", () => {
    for (const snippet of [markSyncing, markSynced, markError, get, deletion]) {
      expect(snippet).toContain("m.organization_id =");
      expect(snippet).toContain("a.organization_id =");
      expect(snippet).toContain("m.email_account_id = a.id");
      expect(snippet).toContain("m.is_draft = true");
    }
  });
});
