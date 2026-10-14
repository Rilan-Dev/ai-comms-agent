import test from "node:test";
import assert from "node:assert/strict";
import { processEmailKnowledgeSyncJob } from "../src/knowledge/email-index-lifecycle";
import type { EmailKnowledgeSyncDependencies, EmailKnowledgeSyncJob, EmailKnowledgeVectorSnapshot } from "../src/knowledge/email-index-lifecycle";

const baseJob: EmailKnowledgeSyncJob = {
  id: "sync-1",
  organization_id: "org-1",
  account_id: "account-2",
  provider: "gmail",
  operation: "delete_account",
  provider_message_id: null,
  source_identity_hash: null,
  content_hash: null,
  metadata_hash: null,
  attempts: 0,
};

const snapshot: EmailKnowledgeVectorSnapshot = {
  organizationId: "org-1",
  accountId: "account-2",
  provider: "gmail",
  providerMessageId: "provider-msg-1",
  sourceIdentityHash: "identity-hash",
  contentHash: "content-hash",
  metadataHash: "metadata-hash",
  metadata: { email_account_id: "account-2" },
  chunks: [{ index: 0, content: "email content", contentHash: "chunk-hash", metadata: { email_account_id: "account-2" } }],
};

function dependencies(overrides: Partial<EmailKnowledgeSyncDependencies> = {}) {
  const calls: string[] = [];
  const deps: EmailKnowledgeSyncDependencies = {
    vectors: {
      upsertMessageVectors: async (value) => { calls.push("upsert"); assert.equal(value.accountId, "account-2"); },
      deleteMessageVectors: async (value) => { calls.push("delete-message"); assert.equal(value.accountId, "account-2"); },
      deleteAccountVectors: async (value) => { calls.push("delete-account"); assert.equal(value.accountId, "account-2"); },
    },
    loadCurrentMessage: async () => snapshot,
    purgePostgresMessageDocuments: async () => { calls.push("purge-message"); },
    purgePostgresAccountDocuments: async () => { calls.push("purge-account"); },
    markCompleted: async () => { calls.push("completed"); },
    scheduleRetry: async (_id, error) => { calls.push("retry"); assert.ok(error.length <= 300); },
    ...overrides,
  };
  return { deps, calls };
}

test("account removal deletes only its account-scoped vectors and completes after PostgreSQL purge", async () => {
  const { deps, calls } = dependencies();
  const result = await processEmailKnowledgeSyncJob(baseJob, deps);
  assert.equal(result.completed, true);
  assert.deepEqual(calls, ["delete-account", "purge-account", "completed"]);
});

test("message upsert sends the current hashes and chunks to the vector adapter", async () => {
  const { deps, calls } = dependencies();
  const result = await processEmailKnowledgeSyncJob({ ...baseJob, operation: "upsert_message", provider_message_id: "provider-msg-1" }, deps);
  assert.equal(result.completed, true);
  assert.deepEqual(calls, ["upsert", "completed"]);
});

test("a stale upsert for a deleted message deletes vectors instead of resurrecting it", async () => {
  const { deps, calls } = dependencies({ loadCurrentMessage: async () => null });
  const result = await processEmailKnowledgeSyncJob({ ...baseJob, operation: "upsert_message", provider_message_id: "provider-msg-1" }, deps);
  assert.equal(result.completed, true);
  assert.deepEqual(calls, ["delete-message", "purge-message", "completed"]);
});

test("a stale delete does not remove vectors if the provider message exists again", async () => {
  const { deps, calls } = dependencies();
  const result = await processEmailKnowledgeSyncJob({ ...baseJob, operation: "delete_message", provider_message_id: "provider-msg-1", source_identity_hash: "identity-hash" }, deps);
  assert.equal(result.completed, true);
  assert.deepEqual(calls, ["completed"]);
});

test("vector failure schedules retry and never marks the job complete", async () => {
  const { deps, calls } = dependencies({
    vectors: {
      upsertMessageVectors: async () => { calls.push("upsert"); throw new Error("vector store unavailable"); },
      deleteMessageVectors: async () => { calls.push("delete-message"); },
      deleteAccountVectors: async () => { calls.push("delete-account"); },
    },
  });
  const result = await processEmailKnowledgeSyncJob({ ...baseJob, operation: "upsert_message", provider_message_id: "provider-msg-1" }, deps);
  assert.equal(result.completed, false);
  assert.deepEqual(calls, ["upsert", "retry"]);
});
