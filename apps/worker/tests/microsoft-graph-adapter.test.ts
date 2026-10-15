import assert from "node:assert/strict";
import test from "node:test";
import { MicrosoftGraphAdapter } from "../src/email/microsoft-graph-adapter.ts";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

test("Microsoft Graph uses v1.0 URLs and follows delta pagination before persisting the delta link", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let deltaCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("/v1.0/me?")) return jsonResponse({ id: "user-1", mail: "user@example.com", displayName: "User" });
    if (url.includes("/messages/delta")) {
      deltaCalls += 1;
      if (deltaCalls === 1) return jsonResponse({
        value: [{ id: "message-1", subject: "First" }],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$skiptoken=page2",
      });
      return jsonResponse({
        value: [{ id: "message-2", subject: "Second" }],
        "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=cursor1",
      });
    }
    throw new Error("Unexpected Graph URL: " + url);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const adapter = new MicrosoftGraphAdapter();
  await adapter.connect({ credential_type: "oauth_token", access_token: "test-token" });
  const first = await adapter.sync({ sync_mode: "initial", last_sync_at: new Date(0).toISOString() });
  assert.equal(first.added[0]?.provider_message_id, "message-1");
  assert.equal(first.new_state.sync_mode, "initial");
  assert.match(first.new_state.cursor ?? "", /\$skiptoken=page2/);

  const second = await adapter.sync({ ...first.new_state, last_sync_at: new Date(0).toISOString() });
  assert.equal(second.added[0]?.provider_message_id, "message-2");
  assert.equal(second.new_state.sync_mode, "incremental");
  assert.match(second.new_state.history_token ?? "", /\$deltatoken=cursor1/);
  assert.equal(deltaCalls, 2);
  assert.ok(requests.every((url) => url.startsWith("https://graph.microsoft.com/v1.0/")));
  await adapter.disconnect();
});

test("Microsoft Graph incremental delta returns updates and deleted message IDs", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/v1.0/me?")) return jsonResponse({ id: "user-1", mail: "user@example.com" });
    if (url.includes("$deltatoken=old")) return jsonResponse({
      value: [
        { id: "updated-message", subject: "Updated" },
        { id: "deleted-message", "@removed": { reason: "deleted" } },
      ],
      "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=new",
    });
    throw new Error("Unexpected Graph URL: " + url);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const adapter = new MicrosoftGraphAdapter();
  await adapter.connect({ credential_type: "oauth_token", access_token: "test-token" });
  const result = await adapter.sync({
    sync_mode: "incremental",
    history_token: "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=old",
    last_sync_at: new Date(0).toISOString(),
  });
  assert.deepEqual(result.updated.map((item) => item.provider_message_id), ["updated-message"]);
  assert.deepEqual(result.deleted, ["deleted-message"]);
  assert.match(result.new_state.history_token ?? "", /\$deltatoken=new/);
  await adapter.disconnect();
});

test("Microsoft Graph creates a mailbox subscription with bounded client state", async (t) => {
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/v1.0/me?")) return jsonResponse({ id: "user-1", mail: "user@example.com" });
    if (url.endsWith("/v1.0/subscriptions")) {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({ id: "subscription-1", expirationDateTime: "2026-10-18T12:00:00Z" });
    }
    throw new Error("Unexpected Graph URL: " + url);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const adapter = new MicrosoftGraphAdapter();
  await adapter.connect({ credential_type: "oauth_token", access_token: "test-token" });
  const subscription = await adapter.createInboxSubscription(
    "https://app.example.test/api/webhooks/microsoft-graph",
    "synthetic-client-state-123456",
    "2026-10-18T12:00:00Z",
  );
  assert.equal(subscription.id, "subscription-1");
  assert.equal(capturedBody?.resource, "me/mailFolders('inbox')/messages");
  assert.equal(capturedBody?.clientState, "synthetic-client-state-123456");
  await adapter.disconnect();
});
