import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, loadCredentialsMock, saveCredentialsMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  loadCredentialsMock: vi.fn(),
  saveCredentialsMock: vi.fn(),
}));
vi.mock("@ai-comms-agent/db", () => ({
  parseCredentialsMasterKey: vi.fn(() => Buffer.from("test-master-key")),
  PostgresEmailAccountRepository: vi.fn(() => ({
    loadCredentials: loadCredentialsMock,
    saveCredentials: saveCredentialsMock,
  })),
  query: queryMock,
}));

import { POST } from "../src/app/api/webhooks/zoho/[token]/route";

const TOKEN = "A".repeat(43);
const ACCOUNT = {
  id: "zoho-account-1",
  organization_id: "org-1",
  email_address: "user@example.com",
  sync_status: "idle",
};
const SECRET = "synthetic-zoho-hook-secret";

function body(payload: unknown = { messageId: "mail-1", folderId: "inbox", zuid: 123 }) {
  return JSON.stringify(payload);
}

function request(rawBody: string, secret = SECRET, storedSecret = false) {
  const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return new Request("https://app.example.test/api/webhooks/zoho/" + TOKEN, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hook-signature": signature,
      ...(storedSecret ? {} : { "x-hook-secret": secret }),
    },
    body: rawBody,
  });
}

const context = { params: Promise.resolve({ token: TOKEN }) };

describe("Zoho Mail outgoing webhook", () => {
  const oldDatabaseUrl = process.env.DATABASE_URL;
  const oldMasterKey = process.env.CREDENTIALS_MASTER_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test";
    process.env.CREDENTIALS_MASTER_KEY = "test-key";
    loadCredentialsMock.mockResolvedValue({ access_token: "oauth-access-token", refresh_token: "oauth-refresh-token" });
    saveCredentialsMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDatabaseUrl;
    if (oldMasterKey === undefined) delete process.env.CREDENTIALS_MASTER_KEY;
    else process.env.CREDENTIALS_MASTER_KEY = oldMasterKey;
  });

  it("authenticates the account-scoped URL and stores the first-request HMAC secret encrypted with credentials", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [ACCOUNT] })
      .mockResolvedValueOnce({ rows: [] });
    const rawBody = body();
    const response = await POST(request(rawBody), context);
    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][1]).toEqual([createHash("sha256").update(TOKEN).digest("hex")]);
    expect(saveCredentialsMock).toHaveBeenCalledWith(
      ACCOUNT.id,
      "oauth_token",
      expect.objectContaining({ access_token: "oauth-access-token", zoho_webhook_secret: SECRET }),
      expect.any(Buffer),
    );
    expect(queryMock.mock.calls[1][0]).toContain("pending_push_at");
  });

  it("rejects a signature mismatch without storing the bootstrap secret or queuing a sync", async () => {
    queryMock.mockResolvedValueOnce({ rows: [ACCOUNT] });
    const rawBody = body();
    const invalid = new Request("https://app.example.test/api/webhooks/zoho/" + TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hook-secret": SECRET,
        "x-hook-signature": "not-a-valid-signature",
      },
      body: rawBody,
    });
    const response = await POST(invalid, context);
    expect(response.status).toBe(401);
    expect(saveCredentialsMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("uses the stored HMAC secret for later requests when Zoho omits x-hook-secret", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [ACCOUNT] })
      .mockResolvedValueOnce({ rows: [] });
    loadCredentialsMock.mockResolvedValue({
      access_token: "oauth-access-token",
      zoho_webhook_secret: SECRET,
    });
    const response = await POST(request(body(), SECRET, true), context);
    expect(response.status).toBe(200);
    expect(saveCredentialsMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("does not queue a paused mailbox", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...ACCOUNT, sync_status: "paused" }] });
    const response = await POST(request(body()), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ skipped: "sync_paused" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown account-scoped tokens", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const response = await POST(request(body()), context);
    expect(response.status).toBe(401);
    expect(loadCredentialsMock).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON even when the HMAC is valid", async () => {
    queryMock.mockResolvedValueOnce({ rows: [ACCOUNT] });
    const rawBody = "{not-json";
    const response = await POST(request(rawBody), context);
    expect(response.status).toBe(400);
    expect(saveCredentialsMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
