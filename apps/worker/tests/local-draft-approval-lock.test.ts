import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repository = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const update = repository.slice(repository.indexOf("export async function updateLocalDraftForOrganization("),
  repository.indexOf("export async function listLocalDraftsForOrganization("));
const deletion = repository.slice(repository.indexOf("export async function deleteLocalDraftForOrganization("),
  repository.indexOf("/** A page of real persisted email threads", repository.indexOf("export async function deleteLocalDraftForOrganization(")));

test("an active send-approval action fences every change to its draft", () => {
  assert.equal((update.match(/AND NOT EXISTS \(/g) ?? []).length, 1, "each draft edit should have one approval fence");
  assert.match(update, /FROM email_actions ea/);
  assert.match(update, /ea\.organization_id = m\.organization_id/);
  assert.match(update, /ea\.draft_id = m\.id/);
  assert.match(update, /ea\.email_account_id = m\.email_account_id/);
  assert.match(update, /ea\.action_type = 'send_email'/);
  assert.match(update, /ea\.status IN \('pending_approval', 'approved'\)/);
  assert.match(update, /ea\.expires_at IS NULL OR ea\.expires_at > now\(\)/);
  assert.match(update, /m\.is_draft = true/);
  assert.match(update, /m\.organization_id = /);
  assert.match(deletion, /ea\.status IN \('pending_approval', 'approved'\)/);
});

test("draft edit route distinguishes a locked draft from a missing draft without bypassing the repository", () => {
  const route = readFileSync(new URL("../../../apps/web/src/app/api/mail/drafts/route.ts", import.meta.url), "utf8");
  const patch = route.slice(route.indexOf("export async function PATCH("),route.indexOf("export async function GET("));
  assert.match(patch, /updateLocalDraftForOrganization\(/);
  assert.match(patch, /getLocalDraftForOrganization\(organizationId, messageId\)/);
  assert.match(patch, /error: "draft_approval_locked"/);
  assert.match(patch, /status: 409/);
  assert.match(patch, /status: 404/);
});

test("executing sends freeze their drafts even after the approval timestamp has expired", () => {
  // The worker claims a valid approval BEFORE expiry but may still be
  // executing AFTER it. Both edits and deletes must stay forbidden.
  for (const sql of [update, deletion]) {
    assert.match(sql, /ea\.status IN \('executing', 'completed'\)/);
    assert.match(sql, /ea\.status IN \('pending_approval', 'approved'\)/);
    assert.match(sql, /ea\.expires_at IS NULL OR ea\.expires_at > now\(\)/);
    assert.doesNotMatch(sql, /ea\.status IN \('pending_approval', 'approved', 'executing'\)\s+AND \(ea\.expires_at/);
  }
});
