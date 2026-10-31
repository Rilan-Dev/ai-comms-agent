import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repo = readFileSync(new URL("../../../packages/db/src/email/actions.ts", import.meta.url), "utf8");
const manual = readFileSync(new URL("../src/app/api/mail/actions/route.ts", import.meta.url), "utf8");
const agent = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");

test("all send_email request sources are serialized against the saved draft before inserting any approval", () => {
  const f = repo.slice(repo.indexOf("export async function createEmailAction("),
    repo.indexOf("export async function listPendingEmailActionsForOrganization("));
  assert.match(f, /input\.actionType === "send_email"/);
  assert.match(f, /input\.draftId/);
  assert.match(f, /withTransaction\(async client\s*=>/);
  assert.match(f, /SELECT id, to_recipients, cc_recipients, bcc_recipients, subject, text_body, thread_id, in_reply_to, references_header FROM email_messages/);
  assert.match(f, /organization_id=\$2 AND email_account_id=\$3 AND is_draft=true/);
  assert.match(f, /FOR UPDATE/);
  assert.match(f, /SELECT \*, \(expires_at IS NULL OR expires_at > now\(\)\) AS unexpired FROM email_actions/);
  assert.match(f, /draft_id=\$3 AND action_type='send_email'/);
  assert.match(f, /client\.query<Row>\(insertSql,params\)/);
  assert.ok(f.indexOf("FOR UPDATE") < f.indexOf("AS unexpired FROM email_actions"));
  assert.ok(f.indexOf("AS unexpired FROM email_actions") < f.indexOf("client.query<Row>(insertSql,params)"));
});

test("one pending draft review is reused only for the same payload, actor and agent; settled reviews fail closed", () => {
  const f = repo.slice(repo.indexOf("export async function createEmailAction("),
    repo.indexOf("export async function listPendingEmailActionsForOrganization("));
  assert.match(f, /existing\.status === "pending_approval"/);
  assert.match(f, /existing\.content_hash === contentHash/);
  assert.match(f, /existing\.requested_by === \(input\.requestedBy \?\? null\)/);
  assert.match(f, /existing\.agent_id === \(input\.agentId \?\? null\)/);
  assert.match(f, /existing\.unexpired === true/);
  assert.match(f, /throw new EmailActionIdempotencyConflictError\(\)/);
  assert.doesNotMatch(f, /DELETE FROM email_actions/);
});

test("same-draft duplicate approval is a visible safe conflict, not a second provider send", () => {
  assert.match(manual, /EmailActionIdempotencyConflictError/);
  assert.match(manual, /status: 409/);
  assert.match(agent, /EmailActionIdempotencyConflictError/);
  assert.match(agent, /email_action_conflict/);
  assert.match(agent, /"pending_approval"/);
  assert.doesNotMatch(manual, /sendDraft\(|claimApprovedEmailAction\(/);
});

test("preserve existing unrelated reply/forward idempotency and human approval gates", () => {
  assert.match(repo, /ON CONFLICT \(organization_id, idempotency_key\)/);
  assert.match(repo, /AND email_actions\.requested_by IS NOT DISTINCT FROM EXCLUDED\.requested_by/);
  assert.match(manual, /actionType === "send_email"/);
  assert.match(manual, /"reply_email"/);
  assert.match(manual, /"forward_email"/);
  assert.match(agent, /createEmailAction\(/);
  assert.match(agent, /"pending_approval"/);
});


test("the locked draft must still match the exact reviewed recipients and body before approval", () => {
  const f = repo.slice(repo.indexOf("export async function createEmailAction("),
    repo.indexOf("export async function listPendingEmailActionsForOrganization("));
  assert.match(repo, /function matchesPersistedSendDraftSnapshot\(/);
  assert.match(f, /SELECT id, to_recipients, cc_recipients, bcc_recipients, subject, text_body, thread_id, in_reply_to, references_header FROM email_messages/);
  assert.match(f, /matchesPersistedSendDraftSnapshot\(lockedDraft, input\.recipientSnapshot\)/);
  assert.ok(f.indexOf("matchesPersistedSendDraftSnapshot(lockedDraft, input.recipientSnapshot)")
    < f.indexOf("client.query<Row>(insertSql,params)"));
  assert.match(repo, /recipientSnapshot\.bodyText/);
  assert.match(repo, /persisted\.text_body/);
  assert.match(repo, /to_recipients/);
  assert.match(repo, /bcc_recipients/);
});


test("strict TypeScript row guards preserve locked-draft validation and idempotent approval reuse", () => {
  const f = repo.slice(repo.indexOf("export async function createEmailAction("),
    repo.indexOf("export async function listPendingEmailActionsForOrganization("));
  assert.match(f, /const lockedDraft = locked\.rows\[0\];/);
  assert.match(f, /if \(!lockedDraft\) throw new EmailActionIdempotencyConflictError\(\)/);
  assert.match(f, /matchesPersistedSendDraftSnapshot\(lockedDraft, input\.recipientSnapshot\)/);
  assert.match(f, /const existing = prior\.rows\[0\];/);
  assert.match(f, /if \(existing\) \{/);
  assert.match(f, /return action\(existing\)/);
  assert.match(f, /const insertedRow = inserted\.rows\[0\];/);
  assert.match(f, /if \(!insertedRow\) throw new EmailActionIdempotencyConflictError\(\)/);
  assert.match(f, /return action\(insertedRow\)/);
  assert.match(f, /const resultRow = r\.rows\[0\];/);
  assert.match(f, /if \(!resultRow\) throw new EmailActionIdempotencyConflictError\(\)/);
  assert.match(f, /return action\(resultRow\)/);
  assert.doesNotMatch(f, /action\((?:locked|prior|inserted|r)\.rows\[0\]\)/);
});
