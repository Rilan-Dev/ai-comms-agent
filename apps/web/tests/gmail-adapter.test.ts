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
});
