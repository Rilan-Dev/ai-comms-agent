import assert from "node:assert/strict";
import test from "node:test";
import { GmailAdapter } from "../src/email/gmail-adapter.ts";

test("Gmail replies preserve the original provider thread and RFC message headers", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ url, method, body });
    if (url.endsWith("/profile")) return new Response(JSON.stringify({ emailAddress: "me@example.com", historyId: "1" }), { status: 200 });
    if (url.endsWith("/messages/source-1?format=full")) return new Response(JSON.stringify({
      id: "source-1", threadId: "thread-1", labelIds: ["INBOX"], snippet: "Original",
      payload: { mimeType: "text/plain", body: { data: Buffer.from("Original message").toString("base64url") }, headers: [
        { name: "From", value: "Customer <customer@example.com>" },
        { name: "Subject", value: "Question" },
        { name: "Message-ID", value: "<original@example.com>" },
        { name: "References", value: "<prior@example.com>" },
      ] },
    }), { status: 200 });
    if (url.endsWith("/drafts") && method === "POST") return new Response(JSON.stringify({ id: "draft-1" }), { status: 200 });
    if (url.endsWith("/drafts/send") && method === "POST") return new Response(JSON.stringify({ id: "sent-1" }), { status: 200 });
    throw new Error(`Unexpected Gmail request ${method} ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const adapter = new GmailAdapter();
  await adapter.connect({ credential_type: "oauth_token", access_token: "test-token" });
  const sent = await adapter.reply("source-1", { to: [], subject: "Re: Question", body_text: "Thanks for the details." });
  assert.deepEqual(sent, { message_id: "sent-1", provider_message_id: "sent-1" });
  const draftCall = calls.find((call) => call.url.endsWith("/drafts") && call.method === "POST");
  const draftBody = JSON.parse(draftCall?.body ?? "{}");
  assert.equal(draftBody.message.threadId, "thread-1");
  const raw = Buffer.from(draftBody.message.raw, "base64url").toString("utf8");
  assert.match(raw, /^To: customer@example\.com\r?$/m);
  assert.match(raw, /^In-Reply-To: <original@example\.com>\r?$/m);
  assert.match(raw, /^References: <prior@example\.com> <original@example\.com>\r?$/m);
  await adapter.disconnect();
});
