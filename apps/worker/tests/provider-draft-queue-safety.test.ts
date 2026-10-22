import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repo = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const dbExports = readFileSync(new URL("../../../packages/db/src/index.ts", import.meta.url), "utf8");
const draftSync = readFileSync(new URL("../src/email/draft-sync.ts", import.meta.url), "utf8");
const queueRoute = readFileSync(new URL("../../../apps/web/src/app/api/mail/drafts/sync/route.ts", import.meta.url), "utf8");
const draftUI = readFileSync(new URL("../../../apps/web/src/app/mail/drafts/drafts-client.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/0054_email_provider_draft_queue.sql", import.meta.url), "utf8");
function section(name: string, next: string) {
  const start = repo.indexOf("export async function " + name);
  const end = repo.indexOf("export async function " + next, start + name.length);
  assert.ok(start >= 0 && end > start, "missing repository function " + name);
  return repo.slice(start, end);
}
const edit = section("updateLocalDraftForOrganization", "listLocalDraftsForOrganization");
const list = section("listDraftsPendingProviderSync", "queueLocalDraftProviderSyncForOrganization");
const queue = section("queueLocalDraftProviderSyncForOrganization", "claimQueuedProviderDraftSyncForOrganization");
const claim = section("claimQueuedProviderDraftSyncForOrganization", "markDraftProviderSyncedForOrganization");
const success = section("markDraftProviderSyncedForOrganization", "markDraftProviderSyncErrorForOrganization");
const failure = section("markDraftProviderSyncErrorForOrganization", "getLocalDraftForOrganization");

test("draft edit uses only migration-allowed states and invalidates a worker lease", () => {
  assert.match(migration, /'local_only','queued','syncing','synced','error'/);
  assert.match(migration, /provider_draft_sync_token uuid/);
  assert.match(edit, /provider_draft_sync_status = 'local_only'/);
  assert.match(edit, /provider_draft_sync_token = NULL/);
  assert.doesNotMatch(edit, /provider_draft_sync_status = 'pending'/);
});

test("user queue is explicit and distinct from worker's atomic queued to syncing claim", () => {
  assert.match(queue, /provider_draft_sync_status = 'queued'/);
  assert.match(queue, /provider_draft_sync_status IN \('local_only', 'synced', 'error'\)/);
  assert.match(queue, /provider_draft_sync_token = NULL/);
  assert.match(queue, /NOT EXISTS \(/);
  assert.match(queue, /email_actions ea/);
  assert.match(claim, /provider_draft_sync_status = 'syncing'/);
  assert.match(claim, /provider_draft_sync_status = 'queued'/);
  assert.match(claim, /provider_draft_sync_token = gen_random_uuid\(\)/);
  assert.match(claim, /RETURNING m\.\*/);
  assert.match(list, /provider_draft_sync_status = 'queued'/);
  assert.match(dbExports, /claimQueuedProviderDraftSyncForOrganization/);
  assert.match(dbExports, /queueLocalDraftProviderSyncForOrganization/);
});

test("late provider results cannot overwrite a draft edited while the network call was running", () => {
  for (const source of [success, failure]) {
    assert.match(source, /provider_draft_sync_status = 'syncing'/);
    assert.match(source, /provider_draft_sync_token = \$4::uuid/);
    assert.match(source, /provider_draft_sync_token = NULL/);
    assert.match(source, /a\.organization_id = \$3/);
  }
  assert.match(draftSync, /const draft = await claimQueuedProviderDraftSyncForOrganization\(/);
  assert.match(draftSync, /const lease = String\(draft\.provider_draft_sync_token\)/);
  assert.match(draftSync, /markDraftProviderSyncedForOrganization\(organizationId, messageId, providerDraftId, lease\)/);
  assert.match(draftSync, /markDraftProviderSyncErrorForOrganization\(organizationId, messageId, message, lease\)/);
  assert.doesNotMatch(draftSync, /await markDraftProviderSyncingForOrganization\(/);
  assert.match(draftSync, /if \(!settled\)/);
});

test("API and draft list UI show queued separately from an active sync", () => {
  assert.match(queueRoute, /queueLocalDraftProviderSyncForOrganization\(/);
  assert.match(queueRoute, /status: "queued"/);
  assert.match(draftUI, /"local_only" \| "queued" \| "syncing"/);
  assert.match(draftUI, /provider_draft_sync_status: "queued"/);
  assert.match(draftUI, /=== "queued" \? "queued"/);
  assert.doesNotMatch(queueRoute, /markDraftProviderSyncingForOrganization/);
});
