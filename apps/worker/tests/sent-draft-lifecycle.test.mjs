import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repository = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const actionWorker = readFileSync(new URL("../src/email/action-worker.ts", import.meta.url), "utf8");
const actionExecutor = readFileSync(new URL("../src/email/action-executor.ts", import.meta.url), "utf8");
const named = (start, end) => {
  const begin = repository.indexOf("export async function " + start);
  const until = repository.indexOf("export async function " + end, begin);
  assert.ok(begin >= 0 && until > begin, start + " and " + end + " must exist");
  return repository.slice(begin, until);
};

test("sent-draft reconciliation only transitions a still-draft record in the owning tenant", () => {
  const sql = named("markLocalDraftSentForOrganization", "deleteLocalDraftForOrganization");
  assert.match(sql, /UPDATE email_messages m/);
  assert.match(sql, /SET is_draft = false, is_sent = true, provider_message_id = \$1/);
  assert.match(sql, /m.id = \$2 AND m.organization_id = \$3/);
  assert.match(sql, /a.organization_id = \$3 AND a.deleted_at IS NULL AND m.is_draft = true/);
  assert.doesNotMatch(sql, /SET is_draft = true/);
});

test("editing, deleting or scheduling a provider sync is blocked after a completed send", () => {
  const scopes = [
    named("updateLocalDraftForOrganization", "listLocalDraftsForOrganization"),
    named("deleteLocalDraftForOrganization", "listMailThreadsForOrganization"),
    named("queueLocalDraftProviderSyncForOrganization", "claimQueuedProviderDraftSyncForOrganization"),
    named("claimQueuedProviderDraftSyncForOrganization", "markDraftProviderSyncedForOrganization"),
  ];
  for (const scope of scopes) {
    assert.match(scope, /ea.organization_id = m.organization_id/);
    assert.match(scope, /ea.draft_id = m.id/);
    assert.match(scope, /ea.email_account_id = m.email_account_id/);
    assert.match(scope, /ea.action_type = 'send_email'/);
    assert.match(scope, /ea.status IN \('executing', 'completed'\)/,
      "completed send must keep the original draft immutable even before reconciliation finishes");
    assert.match(scope, /ea.status IN \('pending_approval', 'approved'\)/);
    assert.match(scope, /ea.expires_at IS NULL OR ea.expires_at > now\(\)/);
  }
});

test("both email executors settle the durable action before best-effort draft reconciliation", () => {
  for (const code of [actionWorker, actionExecutor]) {
    const settlement = code.indexOf('completeEmailAction(');
    const last = code.lastIndexOf('markLocalDraftSentForOrganization(');
    assert.ok(settlement >= 0 && last > settlement);
    assert.match(code, /providerAccepted\s*=\s*true/);
  }
});
