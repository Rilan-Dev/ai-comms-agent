import assert from "node:assert/strict";
import test from "node:test";
import { GmailAdapter } from "../src/email/gmail-adapter.ts";

test("Gmail watch registration validates the topic and stores the provider expiration", async (t) => {
  const originalFetch = globalThis.fetch;
  let watchBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/profile")) {
      return new Response(JSON.stringify({ emailAddress: "user@example.com", historyId: "100" }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }
    if (url.endsWith("/watch")) {
      watchBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ historyId: "101", expiration: String(Date.now() + 6 * 24 * 60 * 60 * 1000) }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }
    throw new Error("Unexpected Gmail URL: " + url);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const adapter = new GmailAdapter();
  await adapter.connect({ access_token: "test-token" } as any);
  const watch = await adapter.registerMailboxWatch("projects/demo-project/topics/gmail-changes");

  assert.equal(watch.historyId, "101");
  assert.ok(Number.isFinite(Date.parse(watch.expiration)));
  assert.deepEqual(watchBody, {
    topicName: "projects/demo-project/topics/gmail-changes",
    labelIds: ["INBOX"],
    labelFilterBehavior: "INCLUDE",
  });
  await adapter.disconnect();
});

test("Gmail watch registration rejects non-qualified Pub/Sub topic names", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ emailAddress: "user@example.com", historyId: "100" }), {
    status: 200, headers: { "content-type": "application/json" },
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  const adapter = new GmailAdapter();
  await adapter.connect({ access_token: "test-token" } as any);
  await assert.rejects(
    adapter.registerMailboxWatch("gmail-changes"),
    /fully-qualified/,
  );
  await adapter.disconnect();
});
