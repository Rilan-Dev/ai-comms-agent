import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workerUrl = new URL("../src/email/mailbox-sync-worker.ts", import.meta.url);
const adapterUrl = new URL("../src/email/gmail-adapter.ts", import.meta.url);
const migrationUrl = new URL("../../../supabase/migrations/0032_email_sync_resumable_page_checkpoints.sql", import.meta.url);

test("mailbox sync stages page IDs and checkpoints each completed message", async () => {
  const source = await readFile(workerUrl, "utf8");
  assert.match(source, /pending_message_ids=\$1::jsonb/);
  // The checkpoint UPDATE uses the `jsonb - text[]` operator (batch removal)
  // instead of the old `jsonb - text` (single removal). This is more efficient
  // — one UPDATE per batch instead of one per message.
  assert.match(source, /pending_message_ids\s*=\s*COALESCE\(pending_message_ids,\s*'\[\]'::jsonb\)\s*-\s*\$1::text\[\]/);
  assert.match(source, /pending_cursor_token=NULL/);
  // The 250ms per-message throttle was removed in favor of batched fetch
  // (Gmail batch endpoint fetches 100 messages per HTTP request).
  // The sync loop now uses BATCH_FETCH_SIZE + PERSIST_CONCURRENCY instead.
  assert.match(source, /BATCH_FETCH_SIZE/);
  assert.match(source, /PERSIST_CONCURRENCY/);
});

test("Gmail quota errors are classified and deferred instead of rapidly retried", async () => {
  const adapter = await readFile(adapterUrl, "utf8");
  const worker = await readFile(workerUrl, "utf8");
  assert.match(adapter, /userRateLimitExceeded\|rateLimitExceeded/);
  assert.match(adapter, /quota\/rate limit; retry later/);
  assert.match(worker, /LEAST\(21600, 300 \* power/);
  assert.match(worker, /quotaDeferred/);
});

test("resumable sync migration adds validated durable checkpoint columns", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /pending_message_ids jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(migration, /pending_cursor_token text/);
  assert.match(migration, /pending_history_id text/);
  assert.match(migration, /pending_sync_mode text/);
  assert.match(migration, /jsonb_typeof\(pending_message_ids\) = 'array'/);
});
