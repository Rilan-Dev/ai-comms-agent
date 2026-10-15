import { describe, expect, it } from "vitest";
import { POST } from "../src/app/api/webhooks/gmail/route";

describe("Gmail Pub/Sub webhook authentication", () => {
  it("rejects requests without a bearer token", async () => {
    const response = await POST(new Request("https://app.example.test/api/webhooks/gmail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: { data: "e30=", messageId: "message-1" } }),
    }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("rejects malformed bearer tokens before parsing notification data", async () => {
    const previousAudience = process.env.GMAIL_PUBSUB_PUSH_AUDIENCE;
    const previousServiceAccount = process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT;
    process.env.GMAIL_PUBSUB_PUSH_AUDIENCE = "test-audience";
    process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT = "push@example.iam.gserviceaccount.com";
    try {
      const response = await POST(new Request("https://app.example.test/api/webhooks/gmail", {
        method: "POST",
        headers: {
          authorization: "Bearer not-a-jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: { data: "e30=", messageId: "message-2" } }),
      }));
      expect(response.status).toBe(401);
    } finally {
      if (previousAudience === undefined) delete process.env.GMAIL_PUBSUB_PUSH_AUDIENCE;
      else process.env.GMAIL_PUBSUB_PUSH_AUDIENCE = previousAudience;
      if (previousServiceAccount === undefined) delete process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT;
      else process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT = previousServiceAccount;
    }
  });
});
