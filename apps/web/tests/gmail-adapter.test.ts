import { describe, expect, it, vi, afterEach } from "vitest";
import { GmailAdapter } from "../../apps/worker/src/email/gmail-adapter";

describe("GmailAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("advertises the provider capability matrix", () => {
    const adapter = new GmailAdapter();
    const capabilities = adapter.capabilities();
    expect(capabilities.folders).toBe(true);
    expect(capabilities.sync_webhook).toBe(true);
    expect(capabilities.sync_idle).toBe(false);
    expect(capabilities.send).toBe(true);
    expect(capabilities.attachments_upload).toBe(false);
  });

  it("requires an OAuth access token", async () => {
    const adapter = new GmailAdapter();
    await expect(adapter.connect({ credential_type: "oauth_token" })).rejects.toThrow(/access token/);
  });

  it("uses the OAuth token for API calls", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ historyId: "123" }), { status: 200 }),
    );
    const adapter = new GmailAdapter();
    await adapter.connect({ credential_type: "oauth_token", access_token: "test-token" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });
  it("refreshes an expired access token before API calls", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ historyId: "123" }), { status: 200 }));
    vi.stubEnv("GMAIL_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GMAIL_OAUTH_CLIENT_SECRET", "client-secret");
    const adapter = new GmailAdapter();
    await adapter.connect({
      credential_type: "oauth_token",
      access_token: "expired-token",
      refresh_token: "refresh-token",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST", body: expect.any(URLSearchParams) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }) }),
    );
  });

  it("refreshes once after an unauthorized API response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ historyId: "123" }), { status: 200 }));
    vi.stubEnv("GMAIL_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GMAIL_OAUTH_CLIENT_SECRET", "client-secret");
    const adapter = new GmailAdapter();
    await adapter.connect({
      credential_type: "oauth_token",
      access_token: "expired-token",
      refresh_token: "refresh-token",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }) }),
    );
  });

});
