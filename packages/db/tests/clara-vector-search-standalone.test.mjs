import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaraEmailVectorSearch } from "../src/email/clara-vector-search.ts";

const key = "safe-service-token-value-for-tests-12345";
const createSearch = (baseUrl = "https://clara.example") =>
  createClaraEmailVectorSearch({ baseUrl, apiKey: key });
const valid = { orgId: "org-1", allowedAccountIds: ["account-1"], query: "invoice", limit: 8 };

test("fail closed on untrusted or empty account scopes without network I/O", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("network should not run"); };
  try {
    const search = createSearch();
    for (const allowedAccountIds of [[], [""], [" account-1"], ["account-1", "account-1"], Array(101).fill("a")]) {
      await assert.rejects(search({ ...valid, allowedAccountIds }), /trusted organization and unique allowed accounts/);
    }
    await assert.rejects(search({ ...valid, orgId: " org-1" }), /trusted organization and unique allowed accounts/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = previous; }
});

test("invalid queries and limits reject before a service-credential request", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("network should not run"); };
  try {
    const search = createSearch();
    for (const query of ["", "   ", "x".repeat(2001)]) {
      await assert.rejects(search({ ...valid, query }), /bounded query/);
    }
    for (const limit of [0, -1, 1.5, NaN, Infinity]) {
      await assert.rejects(search({ ...valid, limit }), /positive integer limit/);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = previous; }
});

test("credential-bearing URLs and non-HTTP schemes are rejected", () => {
  for (const baseUrl of [
    "https://user:password@clara.example",
    "https://clara.example?token=exposed",
    "https://clara.example#fragment",
    "file:///tmp/private",
  ]) {
    assert.throws(() => createSearch(baseUrl), /HTTP or HTTPS|credentials, query, or fragment/);
  }
});

test("scoped request refuses redirects and filters cross-organization hits", async () => {
  const previous = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ ok: true, results: [
      { orgId: "org-1", accountId: "account-1", messageId: "m1", contentHash: "a".repeat(64), score: 0.8 },
      { orgId: "org-2", accountId: "account-1", messageId: "m2", contentHash: "b".repeat(64), score: 0.9 },
      { orgId: "org-1", accountId: "account-2", messageId: "m3", contentHash: "c".repeat(64), score: 0.7 },
      { orgId: "org-1", accountId: "account-1", messageId: "stale", score: 0.99 },
    ] }), { status: 200 });
  };
  try {
    const hits = await createSearch()({ ...valid, limit: 100 });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://clara.example/api/internal/email-vectors");
    assert.equal(requests[0].options.redirect, "error");
    assert.equal(requests[0].options.headers.authorization, "Bearer " + key);
    assert.deepEqual(JSON.parse(requests[0].options.body), { action: "search", ...valid, limit: 20 });
    assert.deepEqual(hits, [{
      orgId: "org-1", accountId: "account-1", messageId: "m1", contentHash: "a".repeat(64), score: 0.8,
    }]);
  } finally { globalThis.fetch = previous; }
});

test("provider failure errors omit secrets and provider bodies", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response("private-provider-body", { status: 503 });
  try {
    await assert.rejects(createSearch()(valid), (error) => {
      assert.match(error.message, /HTTP 503/);
      assert.doesNotMatch(error.message, /private-provider-body|safe-service-token/);
      return true;
    });
  } finally { globalThis.fetch = previous; }
});
