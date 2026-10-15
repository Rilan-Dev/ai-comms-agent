import assert from "node:assert/strict";
import test from "node:test";
import { createClaraEmailVectorSearch } from "@ai-comms-agent/db";

test("Clara vector search sends the resolved account allowlist and rejects out-of-scope hits", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;
  let authorization = "";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      ok: true,
      results: [
        { orgId: "org-a", accountId: "account-a", messageId: "msg-a", sourceId: "point-a", contentHash: "a".repeat(64), score: 0.9 },
        { orgId: "org-a", accountId: "account-b", messageId: "msg-b", score: 0.99 },
        { orgId: "org-b", accountId: "account-a", messageId: "msg-c", score: 0.98 },
        { orgId: "org-a", accountId: "account-a", messageId: "missing-hash", score: 0.95 },
        { orgId: "org-a", accountId: "account-a", messageId: "bad-score", score: "high" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const search = createClaraEmailVectorSearch({
      baseUrl: "https://clara.example",
      apiKey: "service-secret-that-is-long-enough-for-test-123",
    });
    const results = await search({
      orgId: "org-a",
      allowedAccountIds: ["account-a"],
      query: "renewal",
      limit: 8,
    });

    assert.equal(authorization, "Bearer service-secret-that-is-long-enough-for-test-123");
    assert.deepEqual(requestBody, {
      action: "search",
      orgId: "org-a",
      allowedAccountIds: ["account-a"],
      query: "renewal",
      limit: 8,
    });
    assert.deepEqual(results, [{
      orgId: "org-a",
      accountId: "account-a",
      messageId: "msg-a",
      sourceId: "point-a",
      contentHash: "a".repeat(64),
      score: 0.9,
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Clara vector search fails closed on an invalid service credential", () => {
  assert.throws(() => createClaraEmailVectorSearch({
    baseUrl: "https://clara.example",
    apiKey: "short",
  }), /at least 32 characters/);
});
