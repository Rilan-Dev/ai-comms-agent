import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// source contract for the same DB repository imported by both direct web draft
// routes and agent email.draft.create. True transactional rollback still needs
// a disposable PostgreSQL run and cannot be inferred from this test alone.
const repo = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const draft = repo.slice(repo.indexOf("export async function createLocalDraft("),
  repo.indexOf("export async function updateLocalDraftForOrganization("));

test("a draft thread and its message are written on the same PostgreSQL transaction", () => {
  assert.match(draft, /return withTransaction\(async \(client\) => \{/);
  assert.equal((draft.match(/await client\.query<Row>\(/g) ?? []).length, 4,
    "account lookup, optional scoped reply source, thread insert and message insert must use one transactional client");
  assert.doesNotMatch(draft, /await query<Row>\(/);
  const account = draft.indexOf("SELECT id, email_address, status, capabilities, connection_config->>'mailSignatureText' AS mail_signature FROM email_accounts");
  const thread = draft.indexOf("INSERT INTO email_threads");
  const message = draft.indexOf("INSERT INTO email_messages");
  const result = draft.indexOf('return requiredRow(messageResult.rows[0], "draft message")');
  assert.ok(account > 0 && thread > account && message > thread && result > message,
    "any thrown account/insert error must abort the transaction");
});

test("draft creation locks the same-tenant account against concurrent revocation", () => {
  assert.match(draft, /WHERE id = \$1 AND organization_id = \$2 AND deleted_at IS NULL LIMIT 1 FOR SHARE/);
  assert.match(draft, /\[input\.emailAccountId, input\.organizationId\]/);
  assert.match(draft, /email_account_id, organization_id, thread_id/);
  assert.match(draft, /VALUES \(\$1, \$2, \$3/);
  assert.match(draft, /const syncStatus = connected && capabilities\?\.drafts === true \? "queued" : "local_only"/);
  assert.match(draft, /received_at, provider_draft_sync_status/);
  assert.match(draft, /signedBody, syncStatus, inReplyTo, referencesHeader\]/);
});

test("worker email tools and manual draft endpoint share the atomic repository", () => {
  const writeTools = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../../apps/web/src/app/api/mail/drafts/route.ts", import.meta.url), "utf8");
  assert.match(writeTools, /const draft = await createLocalDraft\(\{/);
  assert.match(route, /const draft = await createLocalDraft\(\{/);
});
