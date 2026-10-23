import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repo = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const dbExports = readFileSync(new URL("../../../packages/db/src/index.ts", import.meta.url), "utf8");
const draftSync = readFileSync(new URL("../src/email/draft-sync.ts", import.meta.url), "utf8");
const queueRoute = readFileSync(new URL("../../../apps/web/src/app/api/mail/drafts/sync/route.ts", import.meta.url), "utf8");
const draftUI = readFileSync(new URL("../../../apps/web/src/app/mail/drafts/drafts-client.tsx", import.meta.url), "utf8");
const draftWorker = readFileSync(new URL("../src/email/provider-draft-worker.ts", import.meta.url), "utf8");
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

test("draft edits queue safe provider updates and fence uncertain in-flight operations", () => {
  assert.match(migration, /'local_only','queued','syncing','synced','error'/);
  assert.match(migration, /provider_draft_sync_token uuid/);
  assert.match(edit, /WHEN m\.provider_draft_sync_status IN \('syncing','error'\) THEN 'error'/);
  assert.match(edit, /a\.capabilities->>'drafts' = 'true' THEN 'queued'/);
  assert.match(edit, /ELSE 'local_only' END/);
  assert.match(edit, /provider_draft_sync_token = NULL/);
  assert.doesNotMatch(edit, /provider_draft_sync_status = 'pending'/);
});

test("automatic draft admission uses the existing fenced queue and never replays unknown outcomes", () => {
  const create = section("createLocalDraft", "updateLocalDraftForOrganization");
  const auto = section("queueEligibleLocalDraftsForProviderSync", "listDraftsPendingProviderSync");
  assert.match(create, /capabilities\?\.drafts === true \? "queued" : "local_only"/);
  assert.match(create, /provider_draft_sync_status/);
  assert.match(create, /return withTransaction\(async \(client\) =>/);
  assert.match(auto, /m\.provider_draft_sync_status = 'local_only'/);
  assert.match(auto, /a\.capabilities->>'drafts' = 'true'/);
  assert.match(auto, /a\.status = 'connected'/);
  assert.match(auto, /a\.organization_id = m\.organization_id/);
  assert.match(auto, /NOT EXISTS \(/);
  assert.match(auto, /email_actions ea/);
  assert.match(auto, /FOR UPDATE OF m SKIP LOCKED/);
  assert.match(auto, /provider_draft_sync_status = 'queued'/);
  assert.doesNotMatch(auto, /provider_draft_sync_status = 'error'/);
  assert.match(draftWorker, /await recoverStaleProviderDraftSyncs\(\)/);
  assert.match(draftWorker, /await queueEligibleLocalDraftsForProviderSync\(limit\)/);
  assert.match(draftWorker, /await listDraftsPendingProviderSync\(limit\)/);
  assert.ok(draftWorker.indexOf("await queueEligibleLocalDraftsForProviderSync(limit)") <
    draftWorker.indexOf("await listDraftsPendingProviderSync(limit)"));
  assert.match(queue, /provider_draft_sync_status = 'queued'/);
  assert.match(queue, /provider_draft_sync_status IN \('local_only', 'synced', 'error'\)/);
  assert.match(queue, /provider_draft_sync_token = NULL/);
  assert.match(queue, /NOT EXISTS \(/);
  assert.match(claim, /provider_draft_sync_status = 'syncing'/);
  assert.match(claim, /provider_draft_sync_status = 'queued'/);
  assert.match(claim, /provider_draft_sync_token = gen_random_uuid\(\)/);
  assert.match(claim, /RETURNING m\.\*/);
  assert.match(list, /provider_draft_sync_status = 'queued'/);
  assert.match(list, /a\.status = 'connected'/);
  assert.match(dbExports, /queueEligibleLocalDraftsForProviderSync/);
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
  assert.match(draftSync, /const lease = String\(draft\.provider_draft_sync_token \?\? ""\)/);
  assert.match(draftSync, /markDraftProviderSyncedForOrganization\(organizationId, messageId, providerDraftId, lease\)/);
  assert.match(draftSync, /markDraftProviderSyncErrorForOrganization\(organizationId, messageId, message, lease\)/);
  assert.doesNotMatch(draftSync, /await markDraftProviderSyncingForOrganization\(/);
  assert.match(draftSync, /if \(!settled\)/);
});

test("draft list is compact and does not require manual sync for normal saves", () => {
  assert.match(queueRoute, /queueLocalDraftProviderSyncForOrganization\(/);
  assert.match(queueRoute, /status: "queued"/);
  assert.match(draftUI, /"local_only" \| "queued" \| "syncing"/);
  assert.match(draftUI, /"Saving to mailbox…"/);
  assert.match(draftUI, /"In mailbox drafts"/);
  assert.match(draftUI, /"Sync needs review"/);
  assert.match(draftUI, />Retry sync</);
  assert.match(draftUI, /=== "error" &&/);
  assert.doesNotMatch(draftUI, /"Sync provider draft"/);
  assert.match(draftUI, /Sending still requires approval/);
  assert.doesNotMatch(queueRoute, /markDraftProviderSyncingForOrganization/);
});

test("interrupted syncs become review-required errors and are never silently retried", () => {
  const worker = readFileSync(new URL("../src/email/provider-draft-worker.ts", import.meta.url), "utf8");
  const recovery = repo.slice(repo.indexOf("export async function recoverStaleProviderDraftSyncs("),
    repo.indexOf("export async function getLocalDraftForOrganization("));
  assert.match(recovery, /provider_draft_sync_status = 'error'/);
  assert.match(recovery, /provider_draft_sync_token = NULL/);
  assert.match(recovery, /provider_draft_sync_status = 'syncing'/);
  assert.match(recovery, /updated_at < now\(\) - make_interval/);
  assert.match(worker, /await recoverStaleProviderDraftSyncs\(\)/);
  assert.match(draftSync, /account\.status !== "connected"/);
  assert.match(draftSync, /catch \(auditError\)/);
});
