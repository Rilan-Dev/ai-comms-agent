import assert from "node:assert/strict";
import test from "node:test";
import { createEmailSyncEnvelope } from "../src/queues/email-sync-message";

const accountId = "f16c1c4b-5e84-4b63-a6dd-c7b4a0aee4f1";

test("email.sync envelope follows the documented contract and stable idempotency key", () => {
  const now = new Date("2026-10-09T08:00:00.000Z");
  const message = createEmailSyncEnvelope(
    { account_id: accountId, history_id: "  12345  ", triggered_by: "webhook" },
    { now, messageId: "message-1", correlationId: "request-1" },
  );
  assert.equal(message.id, "message-1");
  assert.equal(message.correlation_id, "request-1");
  assert.equal(message.routing_key, "email.sync");
  assert.equal(message.idempotency_key, `${accountId}:12345`);
  assert.equal(message.attempt_count, 1);
  assert.equal(message.max_attempts, 5);
  assert.equal(message.enqueued_at, now.toISOString());
  assert.equal(message.payload.history_id, "12345");
});

test("email.sync full-sync messages use a stable full-sync idempotency key", () => {
  const message = createEmailSyncEnvelope({ account_id: accountId, triggered_by: "manual" });
  assert.equal(message.idempotency_key, `${accountId}:full`);
  assert.equal(message.payload.history_id, undefined);
});

test("email.sync envelope rejects invalid account IDs and blank cursors", () => {
  assert.throws(
    () => createEmailSyncEnvelope({ account_id: "not-a-uuid", triggered_by: "poll" }),
    /account_id must be a UUID/,
  );
  assert.throws(
    () => createEmailSyncEnvelope({ account_id: accountId, history_id: "  ", triggered_by: "poll" }),
    /history_id must be non-empty/,
  );
});
