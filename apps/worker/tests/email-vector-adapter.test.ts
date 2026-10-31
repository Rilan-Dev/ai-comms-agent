import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createEmailVectorAdapter } from "../src/knowledge/email-vector-adapter.ts";
import type { EmailKnowledgeVectorSnapshot } from "../src/knowledge/email-index-lifecycle.ts";

const originalFetch = globalThis.fetch;
const apiKey = "test-service-secret-that-is-long-enough-123";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const snapshot: EmailKnowledgeVectorSnapshot = {
  organizationId: "org-1",
  accountId: "account-1",
  provider: "gmail",
  providerMessageId: "message-1",
  sourceIdentityHash: "source-hash",
  contentHash: "c".repeat(64),
  metadataHash: "d".repeat(64),
  metadata: {
    from_address: "sender@example.com",
    received_at: "2026-10-16T10:00:00.000Z",
    folder_id: "INBOX",
  },
  chunks: [{
    index: 0,
    pointId: "12345678-1234-8123-8123-123456789012",
    content: "Invoice content",
    contentHash: "e".repeat(64),
    metadata: {},
  }],
};

function successfulResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function mockRequests(response: Response = successfulResponse()) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    // Each HTTP call receives an independent consumable body.
    return response.clone();
  }) as typeof fetch;
  return calls;
}

function adapter(baseUrl = "https://vector.example") {
  return createEmailVectorAdapter({ baseUrl, apiKey });
}

test("worker vector adapter sends deterministic chunk and source metadata", async () => {
  const calls = mockRequests();
  await adapter().upsertMessageVectors(snapshot);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://vector.example/api/internal/email-vectors");
  assert.equal(calls[0]?.init.redirect, "error");
  assert.equal(new Headers(calls[0]?.init.headers).get("authorization"), `Bearer ${apiKey}`);
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    action: "upsert",
    metadata: {
      orgId: "org-1", accountId: "account-1", messageId: "message-1",
      sourceId: "source-hash", receivedAt: "2026-10-16T10:00:00.000Z",
      contentHash: "c".repeat(64), metadataHash: "d".repeat(64),
      sender: "sender@example.com", labels: ["INBOX"],
    },
    chunks: [{
      chunkIndex: 0,
      sourceId: "12345678-1234-8123-8123-123456789012",
      text: "Invoice content",
      contentHash: "e".repeat(64),
    }],
  });
});

test("message deletion and account purge remain separately account-scoped", async () => {
  const calls = mockRequests();
  const vectors = adapter("https://vector.example/api/internal/email-vectors");
  await vectors.deleteMessageVectors({
    organizationId: "org-1", accountId: "account-1",
    provider: "gmail", providerMessageId: "message-1", sourceIdentityHash: "source-hash",
  });
  await vectors.deleteAccountVectors({
    organizationId: "org-1", accountId: "account-1", provider: "gmail",
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    action: "delete_message", orgId: "org-1", accountId: "account-1", messageId: "message-1",
  });
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), {
    action: "purge_account", orgId: "org-1", accountId: "account-1",
  });
  assert.ok(calls.every((call) => call.init.redirect === "error"));
});

test("explicit null sender and folder values clear prior vector metadata", async () => {
  const calls = mockRequests();
  await adapter().upsertMessageVectors({
    ...snapshot,
    metadata: { from_address: null, folder_id: null, received_at: null },
  });
  const body = JSON.parse(String(calls[0]?.init.body));
  assert.equal(body.metadata.sender, null);
  assert.deepEqual(body.metadata.labels, []);
  assert.equal(body.metadata.receivedAt, null);
});

test("missing credentials or unsafe endpoints fail before any request", () => {
  assert.throws(() => createEmailVectorAdapter({ baseUrl: "https://vector.example", apiKey: "" }), /AGENT_EMAIL_VECTOR_API_KEY/);
  for (const url of [
    "https://user:secret@vector.example", "https://vector.example?token=secret",
    "https://vector.example#fragment", "file:///tmp/private",
  ]) {
    assert.throws(() => adapter(url), /HTTP or HTTPS|credentials, query, or fragment/);
  }
});

test("failed provider HTTP response never confirms a vector purge", async () => {
  mockRequests(new Response("provider-secret-body", { status: 502 }));
  await assert.rejects(adapter().deleteAccountVectors({
    organizationId: "org-1", accountId: "account-1", provider: "gmail",
  }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /HTTP 502/);
    assert.doesNotMatch(error.message, /provider-secret-body|test-service-secret/);
    return true;
  });
});

test("a successful HTTP response must explicitly confirm the mutation", async () => {
  mockRequests(new Response(JSON.stringify({ ok: false, error: "provider-private-error" }), { status: 200 }));
  await assert.rejects(adapter().deleteAccountVectors({
    organizationId: "org-1", accountId: "account-1", provider: "gmail",
  }), /did not confirm the operation/);
});

test("malformed successful HTTP response cannot silently complete a job", async () => {
  mockRequests(new Response("not-json", { status: 200 }));
  await assert.rejects(adapter().upsertMessageVectors(snapshot), /invalid response/);
});

test("malformed cross-scope or partial identities never trigger privileged vector requests", async () => {
  const calls = mockRequests();
  const vectors = adapter();
  for (const invalid of [
    { organizationId: "" }, { organizationId: " org-1" },
    { organizationId: "org-1\u0000injected" }, { accountId: "account-1\u007f" },
    { providerMessageId: "message-1\nsecond-line" },
    { accountId: "" }, { accountId: "account-1 " },
    { providerMessageId: "" }, { providerMessageId: "m".repeat(513) },
    { sourceIdentityHash: "" },
    { contentHash: "invalid" }, { metadataHash: "" },
  ]) {
    await assert.rejects(vectors.upsertMessageVectors({ ...snapshot, ...invalid }), /requires valid|requires a valid/);
  }
  await assert.rejects(vectors.deleteMessageVectors({
    organizationId: "org-1",
    accountId: "other-account ",
    provider: "gmail",
    providerMessageId: "message-1",
    sourceIdentityHash: "hash",
  }), /requires a valid account ID/);
  await assert.rejects(vectors.deleteAccountVectors({
    organizationId: "",
    accountId: "account-1",
    provider: "gmail",
  }), /requires a valid organization ID/);
  assert.equal(calls.length, 0, "invalid or empty scope must never reach the service API");
});
