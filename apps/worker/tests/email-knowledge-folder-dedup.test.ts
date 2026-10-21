import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const canonical = readFileSync(new URL("../src/knowledge/email-knowledge-canonical.ts", import.meta.url), "utf8");
const indexer = readFileSync(new URL("../src/knowledge/email-knowledge-indexer-worker.ts", import.meta.url), "utf8");
const writer = readFileSync(new URL("../src/knowledge/email-knowledge-indexer.ts", import.meta.url), "utf8");
const vector = readFileSync(new URL("../src/knowledge/email-knowledge-sync-worker.ts", import.meta.url), "utf8");

test("Gmail IMAP folder copies are ranked only within the same account and RFC822 Message-ID", () => {
  assert.match(canonical, /a\.provider='imap_smtp'/);
  assert.match(canonical, /NULLIF\(BTRIM\(m\.internet_message_id\), ''\) IS NOT NULL/);
  assert.match(canonical, /peer\.email_account_id=m\.email_account_id/);
  assert.match(canonical, /peer\.organization_id=m\.organization_id/);
  assert.match(canonical, /LOWER\(BTRIM\(peer\.internet_message_id\)\)=LOWER\(BTRIM\(m\.internet_message_id\)\)/);
  assert.match(canonical, /peer\.id<>m\.id/);
  assert.match(canonical, /peer\.id\)\s*<\s*\(/);
  assert.match(canonical, /role='inbox'/);
  assert.match(canonical, /provider_folder_id\)='INBOX'/);
});

test("pending duplicate rows are acknowledged without a second knowledge document", () => {
  assert.match(indexer, /IMAP_SHADOW_COPY_SQL/);
  assert.match(indexer, /AS shadow_copy/);
  assert.match(indexer, /c\.indexed_at IS NULL/);
  assert.match(writer, /IMAP_SHADOW_COPY_SQL/);
  assert.match(writer, /shadow_copy/);
  assert.match(writer, /if \(!activeAccount\.rows\[0\] \|\| activeAccount\.rows\[0\]\.shadow_copy/);
  assert.match(writer, /await deleteEmailKnowledge\(organizationId, accountId, providerMessageId, provider\)/);
});

test("already indexed folder duplicates are reconciled, with document and vector cleanup", () => {
  assert.match(indexer, /c\.shadow_copy AND EXISTS \(/);
  assert.match(indexer, /knowledge_documents d/);
  assert.match(indexer, /d\.metadata->>'email_account_id'=c\.email_account_id::text/);
  assert.match(indexer, /d\.metadata->>'provider_message_id'=c\.provider_message_id/);
  assert.match(vector, /IMAP_SHADOW_COPY_SQL/);
  assert.match(vector, /AND NOT \(\$\{IMAP_SHADOW_COPY_SQL\}\)/);
  assert.match(writer, /operation='delete_message'/);
});

test("when the preferred folder copy disappears an existing survivor is reindexed", () => {
  assert.match(indexer, /NOT c\.shadow_copy AND NOT EXISTS \(/);
  assert.match(indexer, /c\.is_draft=false/);
  assert.match(indexer, /c\.indexed_at IS NOT NULL/);
  assert.match(indexer, /INDEXER_CONCURRENCY/);
});

test("do not change provider storage IDs, merge distinct messages, or drop physical mailbox records", () => {
  assert.match(writer, /provider_message_id: providerMessageId/);
  assert.match(writer, /storagePath = `\$\{accountId\}\/\$\{encodeURIComponent\(providerMessageId\)\}`/);
  assert.doesNotMatch(indexer, /DELETE FROM email_messages/);
  assert.doesNotMatch(writer, /DELETE FROM email_messages/);
});
