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
    const response = await POST(new Request("https://app.example.test/api/webhooks/gmail", {
      method: "POST",
      headers: {
        authorization: "Bearer not-a-jwt",
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: { data: "e30=", messageId: "message-2" } }),
    }));
    expect(response.status).toBe(401);
  });
});
