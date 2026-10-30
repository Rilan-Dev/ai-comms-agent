import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const repo = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/email/provider-draft-worker.ts", import.meta.url), "utf8");
const readTools = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-read-tools.ts", import.meta.url), "utf8");
const writeTools = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../../../packages/shared/src/agent/mail-operations.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../../../apps/web/src/app/mail/drafts/drafts-client.tsx", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const body = (first: string, second: string) => {
  const i = repo.indexOf("export async function " + first + "(");
  const end = repo.indexOf("export async function " + second + "(", i + 1);
  assert.ok(i >= 0 && end > i, "Repository function is missing: " + first);
  return repo.slice(i, end);
};

test("new drafts atomically queue provider saving only for connected, capable accounts", () => {
  const create = body("createLocalDraft", "updateLocalDraftForOrganization");
  assert.match(create, /return withTransaction\(async \(client\) =>/);
  assert.match(create, /SELECT id, email_address, status, capabilities, connection_config->>\x27mailSignatureText\x27 AS mail_signature FROM email_accounts/);
  assert.match(create, /deleted_at IS NULL LIMIT 1 FOR SHARE/);
  assert.match(create, /capabilities\?\.drafts === true \? "queued" : "local_only"/);
  assert.match(create, /received_at, provider_draft_sync_status/);
  assert.match(writeTools, /const draft = await createLocalDraft\(\{/);
  assert.doesNotMatch(create, /createEmailAction\(|sendEmail\(/);
});

test("old local-only drafts join a bounded queue, without replaying uncertain provider outcomes", () => {
  const admission = body("queueEligibleLocalDraftsForProviderSync", "listDraftsPendingProviderSync");
  assert.match(admission, /m\.provider_draft_sync_status = 'local_only'/);
  assert.match(admission, /m\.provider_draft_sync_token IS NULL/);
  assert.match(admission, /a\.status = 'connected' AND a\.deleted_at IS NULL/);
  assert.match(admission, /a\.capabilities->>'drafts' = 'true'/);
  assert.match(admission, /a\.organization_id = m\.organization_id/);
  assert.match(admission, /NOT EXISTS \(/);
  assert.match(admission, /FOR UPDATE OF m SKIP LOCKED/);
  assert.match(admission, /provider_draft_sync_status = 'queued'/);
  assert.doesNotMatch(admission, /'syncing','error'/);
  assert.match(worker, /queueEligibleLocalDraftsForProviderSync\(limit\)/);
  assert.match(index, /startProviderDraftSyncLoop\(\)/);
});

test("AI can list its authorized drafts and see pending mailbox sync without writing or sending", () => {
  assert.match(schema, /emailTool\("email\.messages\.list",[^\n]+drafts_only/);
  assert.match(schema, /emailTool\("email\.search",[^\n]+drafts_only/);
  assert.match(readTools, /const account = await resolveAccount\(text\(input\.account_id\), context\)/);
  assert.match(readTools, /"m\.organization_id = \$1", "m\.email_account_id = \$2"/);
  assert.match(readTools, /if \(input\.drafts_only === true\) conditions\.push\("m\.is_draft = true"\)/);
  assert.match(readTools, /m\.to_recipients AS to_addresses/);
  assert.match(readTools, /input\.drafts_only===true\?'m\.updated_at':'m\.received_at'/);
  assert.match(readTools, /provider_draft_sync_status: row\.is_draft \?/);
  assert.doesNotMatch(readTools, /createEmailAction\(|sendEmail\(/);
});

test("draft inbox stays concise and exposes retry only for uncertain provider errors", () => {
  assert.match(ui, /"Sync needs review"/);
  assert.match(ui, /"Saving to mailbox…"/);
  assert.match(ui, /"In mailbox drafts"/);
  assert.match(ui, /draft\.provider_draft_sync_status === "error"/);
  assert.match(ui, /window\.confirm\(/);
  assert.match(ui, /Retry sync/);
  assert.doesNotMatch(ui, /Sync provider draft/);
  assert.match(ui, /Sending still requires approval/);
  // Background status refresh must not resurrect deleted drafts or
  // overwrite a recent manual retry with an older GET response.
  assert.match(ui, /requestId === latestRequest/);
  assert.match(ui, /revision === mutationRevision\.current/);
  assert.match(ui, /!mutationRunning\.current/);
  assert.match(ui, /mutationRevision\.current \+= 1/);
  assert.match(ui, /return \(\) => \{ cancelled = true; clearInterval\(interval\); \}/);
});
