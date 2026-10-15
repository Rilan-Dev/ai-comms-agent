import assert from "node:assert/strict";
import test from "node:test";
import { GmailAdapter } from "../src/email/gmail-adapter.ts";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Gmail incremental sync returns the newest history cursor only after all history pages", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let historyCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/profile")) return jsonResponse({ emailAddress: "user@example.com", historyId: "120" });
    if (url.includes("/history?")) {
      historyCalls += 1;
      if (!url.includes("pageToken=next")) return jsonResponse({
        historyId: "130",
        nextPageToken: "next",
        history: [{
          messagesAdded: [{ message: { id: "new-message" } }],
          labelsAdded: [{ message: { id: "changed-message" } }, { message: { id: "new-message" } }],
          messagesDeleted: [{ message: { id: "deleted-message" } }],
        }],
      });
      return jsonResponse({
        historyId: "131",
        history: [{ labelsRemoved: [{ message: { id: "second-page-message" } }] }],
      });
    }
    throw new Error("Unexpected Gmail URL: " + url);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const adapter = new GmailAdapter();
  await adapter.connect({ access_token: "test-token" } as any);
  const result = await adapter.sync({
    sync_mode: "incremental",
    history_token: "120",
  } as any);

  assert.deepEqual(result.added.map((item) => item.provider_message_id), ["new-message"]);
  assert.deepEqual(result.updated.map((item) => item.provider_message_id).sort(), ["changed-message", "second-page-message"]);
  assert.deepEqual(result.deleted, ["deleted-message"]);
  assert.equal(result.new_state.history_token, "131");
  assert.equal(historyCalls, 2);
  await adapter.disconnect();
});

test("Gmail expired history cursor falls back to a fresh initial baseline", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let profileCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/profile")) {
      profileCalls += 1;
      return jsonResponse({ emailAddress: "user@example.com", historyId: profileCalls === 1 ? "120" : "140" });
    }
    if (url.includes("/history?")) return jsonResponse({ error: { message: "History cursor expired" } }, 404);
    if (url.includes("/messages?")) return jsonResponse({ messages: [] });
    throw new Error("Unexpected Gmail URL: " + url);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const adapter = new GmailAdapter();
  await adapter.connect({ access_token: "test-token" } as any);
  const result = await adapter.sync({
    sync_mode: "incremental",
    history_token: "1",
  } as any);

  assert.equal(profileCalls, 2);
  assert.equal(result.new_state.history_token, "140");
  assert.equal(result.new_state.sync_mode, "incremental");
  assert.ok(requests.some((url) => url.includes("/messages?")));
  await adapter.disconnect();
});
