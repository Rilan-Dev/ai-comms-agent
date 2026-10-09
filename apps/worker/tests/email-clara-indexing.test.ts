import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const indexer = readFileSync(resolve(process.cwd(), "../../packages/clara-core/src/email-indexing.ts"), "utf8");
const runtime = readFileSync(resolve(process.cwd(), "../../packages/clara-core/src/runtime.ts"), "utf8");
const worker = readFileSync(resolve(process.cwd(), "src/email/mailbox-sync-worker.ts"), "utf8");

test("Clara email indexer writes through the existing knowledge document/chunk contract", () => {
  assert.match(indexer, /INSERT INTO knowledge_documents/);
  assert.match(indexer, /INSERT INTO knowledge_chunks/);
  assert.match(indexer, /ON CONFLICT \(organization_id, storage_bucket, storage_path\) WHERE storage_path IS NOT NULL/);
  assert.match(indexer, /ON CONFLICT \(document_id, chunk_index\)/);
  assert.match(indexer, /sha256\(/);
  assert.match(indexer, /organizationId/);
  assert.match(indexer, /embedding_provider, embedding_model, vector_reference/);
  assert.match(indexer, /email_account_id: scope\.accountId/);
  assert.doesNotMatch(indexer, /QDRANT_URL|qdrant-client|fetch\(.*qdrant/i);
});

test("email indexing is invoked only after mailbox messages are persisted", () => {
  assert.match(worker, /await persistMessage\(candidate, message, providerDraftId\);\s*await indexEmailForClara\(/);
  assert.match(worker, /organizationId: candidate\.organization_id/);
  assert.match(worker, /accountId: candidate\.id/);
});

test("agent retrieval includes organization-shared and agent-specific knowledge without crossing organizations", () => {
  assert.match(runtime, /kc\.organization_id = \$1/);
  assert.match(runtime, /kd\.organization_id = kc\.organization_id/);
  assert.match(runtime, /kd\.agent_id IS NULL OR kd\.agent_id::text = \$2/);
});
