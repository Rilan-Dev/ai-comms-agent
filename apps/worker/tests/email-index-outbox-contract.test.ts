import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/0048_email_knowledge_sync_jobs.sql", import.meta.url);

test("email vector outbox supports message upsert/delete and account purge with independent idempotency keys", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /operation IN \('upsert_message','delete_message','delete_account'\)/);
  assert.match(sql, /email_knowledge_upsert_unique_idx[\s\S]*WHERE operation='upsert_message'/);
  assert.match(sql, /email_knowledge_delete_message_unique_idx[\s\S]*WHERE operation='delete_message'/);
  assert.match(sql, /email_knowledge_delete_account_unique_idx[\s\S]*WHERE operation='delete_account'/);
  assert.match(sql, /account_id uuid NOT NULL/);
  assert.match(sql, /CHECK \(\(operation='delete_account' AND provider_message_id IS NULL\)/);
});
