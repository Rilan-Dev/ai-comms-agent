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
