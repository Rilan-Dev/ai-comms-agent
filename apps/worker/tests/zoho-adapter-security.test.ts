import test from "node:test";
import assert from "node:assert/strict";
import { ZohoAdapter } from "../src/email/zoho-adapter";

test("Zoho adapter rejects non-Zoho API domains before network access", async () => {
  const adapter = new ZohoAdapter();

  await assert.rejects(
    adapter.connect({
      credential_type: "oauth_token",
      access_token: "test-token",
      api_domain: "https://127.0.0.1:8080",
    }),
    /not an allowed Zoho Mail endpoint/,
  );

  await assert.rejects(
    adapter.connect({
      credential_type: "oauth_token",
      access_token: "test-token",
      api_domain: "http://mail.zoho.in",
    }),
    /HTTPS origin/,
  );
});

test("Zoho adapter accepts supported regional Mail API origins", async () => {
  // The adapter will proceed to the network only after endpoint validation.
  // Stub fetch so this test remains deterministic and does not require credentials.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ data: [{ accountId: "123", emailAddress: "user@example.com" }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

  try {
    const adapter = new ZohoAdapter();
    await adapter.connect({
      credential_type: "oauth_token",
      access_token: "test-token",
      api_domain: "https://mail.zoho.in",
      account_id: "123",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("Zoho regional refresh uses the matching accounts domain", async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.ZOHO_OAUTH_CLIENT_ID;
  const originalClientSecret = process.env.ZOHO_OAUTH_CLIENT_SECRET;
  process.env.ZOHO_OAUTH_CLIENT_ID = "client";
  process.env.ZOHO_OAUTH_CLIENT_SECRET = "secret";
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://mail.zoho.eu/api/accounts")) {
      return new Response(JSON.stringify({ data: [{ accountId: "123", emailAddress: "user@example.eu" }] }), { status: 200 });
    }
    if (url === "https://accounts.zoho.eu/oauth/v2/token") {
      return new Response(JSON.stringify({ access_token: "refreshed-token", expires_in: 3600, api_domain: "https://mail.zoho.eu" }), { status: 200 });
    }
    throw new Error("Unexpected network call: " + url);
  };
  try {
    const adapter = new ZohoAdapter();
    await adapter.connect({ credential_type: "oauth_token", access_token: "expired-token", refresh_token: "refresh", api_domain: "https://mail.zoho.eu", account_id: "123", expires_at: new Date(Date.now() - 1000).toISOString() });
    assert.ok(calls.includes("https://accounts.zoho.eu/oauth/v2/token"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalClientId === undefined) delete process.env.ZOHO_OAUTH_CLIENT_ID; else process.env.ZOHO_OAUTH_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.ZOHO_OAUTH_CLIENT_SECRET; else process.env.ZOHO_OAUTH_CLIENT_SECRET = originalClientSecret;
  }
});
