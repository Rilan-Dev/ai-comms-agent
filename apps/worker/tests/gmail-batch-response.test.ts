import assert from "node:assert/strict";
import test from "node:test";
import { GmailAdapter } from "../src/email/gmail-adapter.ts";

test("Gmail batch parser strips Google's response- Content-ID prefix", () => {
  const adapter = new GmailAdapter();
  const result = new Map<string, any>();
  const message = {
    id: "gmail-message-123",
    threadId: "thread-1",
    labelIds: ["INBOX", "UNREAD"],
    snippet: "Hello",
    internalDate: "1792000000000",
    payload: {
      headers: [
        { name: "From", value: "sender@example.com" },
        { name: "Subject", value: "Batch response mapping" },
      ],
      mimeType: "text/plain",
      body: { data: Buffer.from("body").toString("base64url") },
    },
  };
  const body = [
    "--batch_response_boundary",
    "Content-Type: application/http",
    "Content-ID: <response-gmail-message-123@ai-comms-agent.local>",
    "",
    "HTTP/1.1 200 OK",
    "Content-Type: application/json",
    "",
    JSON.stringify(message),
    "--batch_response_boundary--",
    "",
  ].join("\r\n");

  (adapter as any).parseBatchResponse(body, ["gmail-message-123"], result);

  assert.equal(result.size, 1);
  assert.equal(result.has("gmail-message-123"), true);
  assert.equal(result.get("gmail-message-123").subject, "Batch response mapping");
  assert.equal(result.get("gmail-message-123").text_body, "body");
});
