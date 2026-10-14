import test from "node:test";
import assert from "node:assert/strict";
import { processEmailKnowledgeCleanupJob } from "../src/knowledge/email-index-lifecycle";

const job = {
  id: "cleanup-1",
  organization_id: "org-1",
  account_id: "account-2",
  provider: "gmail" as const,
  attempts: 0,
};

test("account cleanup deletes only the specified provider/account and completes after both stores", async () => {
  const calls: string[] = [];
  const result = await processEmailKnowledgeCleanupJob(job, {
    vectors: { deleteAccountVectors: async (input) => {
      assert.deepEqual(input, { organizationId: "org-1", accountId: "account-2", provider: "gmail" });
      calls.push("vectors");
    } },
    purgePostgresDocuments: async (input) => {
      assert.deepEqual(input, { organizationId: "org-1", accountId: "account-2" });
      calls.push("postgres");
    },
    markCompleted: async () => { calls.push("completed"); },
    scheduleRetry: async () => { calls.push("retry"); },
  });
  assert.equal(result.completed, true);
  assert.deepEqual(calls, ["vectors", "postgres", "completed"]);
});

test("vector deletion failure schedules retry and never marks cleanup complete", async () => {
  const calls: string[] = [];
  const result = await processEmailKnowledgeCleanupJob(job, {
    vectors: { deleteAccountVectors: async () => { calls.push("vectors"); throw new Error("vector store unavailable"); } },
    purgePostgresDocuments: async () => { calls.push("postgres"); },
    markCompleted: async () => { calls.push("completed"); },
    scheduleRetry: async (id, error) => { calls.push("retry"); assert.equal(id, job.id); assert.match(error, /vector store unavailable/); },
  });
  assert.equal(result.completed, false);
  assert.deepEqual(calls, ["vectors", "retry"]);
});

test("PostgreSQL cleanup failure remains retryable after vector deletion", async () => {
  const calls: string[] = [];
  const result = await processEmailKnowledgeCleanupJob(job, {
    vectors: { deleteAccountVectors: async () => { calls.push("vectors"); } },
    purgePostgresDocuments: async () => { calls.push("postgres"); throw new Error("database unavailable"); },
    markCompleted: async () => { calls.push("completed"); },
    scheduleRetry: async () => { calls.push("retry"); },
  });
  assert.equal(result.completed, false);
  assert.deepEqual(calls, ["vectors", "postgres", "retry"]);
});
