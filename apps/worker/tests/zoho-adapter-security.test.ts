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


test("Zoho regional refresh uses the matching accounts domain and saved per-account client", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, body: typeof init?.body === "string" ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : undefined });
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
    await adapter.connect({
      credential_type: "oauth_token", access_token: "expired-token", refresh_token: "refresh",
      api_domain: "https://mail.zoho.eu", account_id: "123",
      zoho_client_id: "saved-client", zoho_client_secret: "saved-secret",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    assert.ok(calls.some((call) => call.url === "https://accounts.zoho.eu/oauth/v2/token"));
    const tokenRequest = calls.find((call) => call.url === "https://accounts.zoho.eu/oauth/v2/token");
    assert.match(tokenRequest?.body ?? "", /client_id=saved-client/);
    assert.match(tokenRequest?.body ?? "", /client_secret=saved-secret/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("Zoho adapter maps folder, label, read-state and move operations to the documented API", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : undefined });
    if (url.endsWith("/api/accounts")) {
      return new Response(JSON.stringify({ data: [{ accountId: "123", emailAddress: "user@example.com" }] }), { status: 200 });
    }
    if (url.endsWith("/api/accounts/123")) {
      return new Response(JSON.stringify({ data: { emailAddress: "user@example.com" } }), { status: 200 });
    }
    if (url.endsWith("/api/accounts/123/folders")) {
      return new Response(JSON.stringify({ data: [{ folderId: "9", folderName: "Inbox", unreadCount: 2 }] }), { status: 200 });
    }
    if (url.endsWith("/api/accounts/123/labels")) {
      return new Response(JSON.stringify({ data: [{ labelId: "7", labelName: "Important" }] }), { status: 200 });
    }
    if (url.endsWith("/api/accounts/123/updatemessage")) {
      return new Response(JSON.stringify({ status: { code: 200, description: "success" } }), { status: 200 });
    }
    if (url.endsWith("/api/accounts/123/messages/88")) {
      return new Response(JSON.stringify({ data: { messageId: "99" } }), { status: 200 });
    }
    throw new Error("Unexpected network call: " + url);
  };

  try {
    const adapter = new ZohoAdapter();
    await adapter.connect({
      credential_type: "oauth_token",
      access_token: "test-token",
      api_domain: "https://mail.zoho.in",
      account_id: "123",
    });

    const folders = await adapter.listFolders();
    assert.equal(folders[0]?.name, "Inbox");
    const labels = await adapter.listLabels();
    assert.equal(labels[0]?.name, "Important");
    await adapter.markRead(["10"], true);
    await adapter.markUnread(["10"]);
    await adapter.move(["10"], "9");
    await adapter.archive(["10"]);
    const reply = await adapter.reply("88", { to: ["recipient@example.com"], subject: "Re", body_text: "Reply" });
    assert.equal(reply.provider_message_id, "99");

    const updateBodies = calls.filter((call) => call.url.endsWith("/updatemessage")).map((call) => JSON.parse(call.body ?? "{}"));
    assert.deepEqual(updateBodies.map((body) => body.mode), ["markAsRead", "markAsUnread", "move", "archive"]);
    assert.equal(updateBodies[2].folderId, "9");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("Zoho adapter exposes implemented draft lifecycle operations", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : undefined });
    if (url.endsWith("/api/accounts")) return new Response(JSON.stringify({ data: [{ accountId: "123", emailAddress: "user@example.com" }] }), { status: 200 });
    if (url.endsWith("/api/accounts/123")) return new Response(JSON.stringify({ data: { emailAddress: "user@example.com" } }), { status: 200 });
    if (url.endsWith("/api/accounts/123/messages") && (init?.method ?? "GET") === "POST") return new Response(JSON.stringify({ data: { messageId: "draft-1" } }), { status: 200 });
    if (url.endsWith("/api/accounts/123/messages/draft-1") && init?.method === "PUT") return new Response(JSON.stringify({ data: { messageId: "draft-1" } }), { status: 200 });
    throw new Error("Unexpected network call: " + url);
  };
  try {
    const adapter = new ZohoAdapter();
    await adapter.connect({ credential_type: "oauth_token", access_token: "test-token", api_domain: "https://mail.zoho.in", account_id: "123" });
    const draft = await adapter.createDraft({ to: ["recipient@example.com"], subject: "Draft", body_text: "Hello" });
    assert.equal(draft.draft_id, "draft-1");
    const updated = await adapter.updateDraft("draft-1", { subject: "Updated", body_text: "Updated body" });
    assert.equal(updated.draft_id, "draft-1");
    const draftCall = calls.find((call) => call.url.endsWith("/messages") && call.method === "POST");
    assert.equal(JSON.parse(draftCall?.body ?? "{}").mode, "draft");
    const updateCall = calls.find((call) => call.url.endsWith("/messages/draft-1") && call.method === "PUT");
    assert.equal(JSON.parse(updateCall?.body ?? "{}").subject, "Updated");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("Zoho adapter creates drafts using the documented Mail API", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : undefined });
    if (url.endsWith("/api/accounts")) return new Response(JSON.stringify({ data: [{ accountId: "123", emailAddress: "user@example.com" }] }), { status: 200 });
    if (url.endsWith("/api/accounts/123")) return new Response(JSON.stringify({ data: { emailAddress: "user@example.com" } }), { status: 200 });
    if (url.endsWith("/api/accounts/123/messages") && (init?.method ?? "GET") === "POST") return new Response(JSON.stringify({ data: { messageId: "draft-1" } }), { status: 200 });
    throw new Error("Unexpected network call: " + url);
  };
  try {
    const adapter = new ZohoAdapter();
    await adapter.connect({ credential_type: "oauth_token", access_token: "test-token", api_domain: "https://mail.zoho.in", account_id: "123" });
    const draft = await adapter.createDraft({ to: ["recipient@example.com"], subject: "Draft", body_text: "Hello" });
    assert.equal(draft.draft_id, "draft-1");
    const call = calls.find((item) => item.url.endsWith("/messages") && item.method === "POST");
    assert.equal(JSON.parse(call?.body ?? "{}").mode, "draft");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("Zoho sync paginates initial folder import and refreshes newest folder pages idempotently", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/api/accounts")) {
      return new Response(JSON.stringify({ data: [{ accountId: "123", emailAddress: "user@example.com" }] }), { status: 200 });
    }
    if (url.endsWith("/api/accounts/123")) {
      return new Response(JSON.stringify({ data: { emailAddress: "user@example.com" } }), { status: 200 });
    }
    if (url.endsWith("/api/accounts/123/folders")) {
      return new Response(JSON.stringify({ data: [
        { folderId: "9", folderName: "Inbox" },
        { folderId: "10", folderName: "Drafts" },
      ] }), { status: 200 });
    }
    if (url.includes("/api/accounts/123/messages/view?")) {
      const parsed = new URL(url);
      const folderId = parsed.searchParams.get("folderId");
      return new Response(JSON.stringify({ data: [{
        messageId: folderId === "10" ? "draft-1" : "msg-1",
        folderId,
        folderName: folderId === "10" ? "Drafts" : "Inbox",
        fromAddress: "sender@example.com",
        subject: "Sync contract",
        content: "test body",
        receivedTime: Date.now(),
      }] }), { status: 200 });
    }
    throw new Error("Unexpected network call: " + url);
  };
  try {
    const adapter = new ZohoAdapter();
    await adapter.connect({ credential_type: "oauth_token", access_token: "test-token", api_domain: "https://mail.zoho.in", account_id: "123" });
    const initial = await adapter.sync({ last_sync_at: new Date(0).toISOString(), sync_mode: "initial" });
    assert.deepEqual(initial.added.map((message) => message.provider_message_id), ["msg-1", "draft-1"]);
    assert.equal(initial.new_state.sync_mode, "incremental");
    assert.equal(initial.new_state.history_token, "zoho-full-v1");
    const incremental = await adapter.sync({ ...initial.new_state, sync_mode: "incremental" });
    assert.deepEqual(incremental.updated.map((message) => message.provider_message_id), ["msg-1", "draft-1"]);
    assert.equal(calls.filter((url) => url.includes("/messages/view?")).length, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
