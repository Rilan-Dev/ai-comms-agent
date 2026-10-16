import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, loadCredentialsMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  loadCredentialsMock: vi.fn(),
}));
vi.mock("@ai-comms-agent/db", () => ({
  parseCredentialsMasterKey: vi.fn(() => Buffer.from("test-master-key")),
  PostgresEmailAccountRepository: vi.fn(() => ({ loadCredentials: loadCredentialsMock })),
  query: queryMock,
}));

import { GET, POST } from "../src/app/api/webhooks/microsoft-graph/route";

const CLIENT_STATE = "synthetic-client-state-123456";
const ACCOUNT = { id: "graph-account-1", organization_id: "org-1", sync_status: "idle" };

function notification(clientState = CLIENT_STATE, subscriptionId = "subscription-1") {
  return JSON.stringify({
    value: [{ subscriptionId, clientState, changeType: "created", resource: "me/mailFolders('inbox')/messages('message-1')" }],
  });
}

const contextUrl = "https://app.example.test/api/webhooks/microsoft-graph";

describe("Microsoft Graph notification endpoint", () => {
  const oldDatabaseUrl = process.env.DATABASE_URL;
  const oldMasterKey = process.env.CREDENTIALS_MASTER_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test";
    process.env.CREDENTIALS_MASTER_KEY = "test-key";
    loadCredentialsMock.mockResolvedValue({ microsoft_graph_client_state: CLIENT_STATE });
  });

  afterEach(() => {
    if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDatabaseUrl;
    if (oldMasterKey === undefined) delete process.env.CREDENTIALS_MASTER_KEY;
    else process.env.CREDENTIALS_MASTER_KEY = oldMasterKey;
  });

  it("returns Graph validation tokens as plain text", async () => {
    const response = await GET(new Request(contextUrl + "?validationToken=validate%2Bme"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("validate+me");
  });

  it("queues only a notification whose subscription and clientState match a connected mailbox", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [ACCOUNT] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await POST(new Request(contextUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: notification(),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: 1, rejected: 0 });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1]![0]).toContain("pending_push_at");
  });

  it("ignores notifications with an invalid clientState", async () => {
    queryMock.mockResolvedValueOnce({ rows: [ACCOUNT] });
    const response = await POST(new Request(contextUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: notification("attacker-state"),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: 0, rejected: 1 });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("acknowledges unknown subscription IDs without scheduling a sync", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const response = await POST(new Request(contextUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: notification(),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: 0, rejected: 1 });
  });

  it("does not queue paused mailboxes", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...ACCOUNT, sync_status: "paused" }] });
    const response = await POST(new Request(contextUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: notification(),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: 1 });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed notification envelopes", async () => {
    const response = await POST(new Request(contextUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "not-an-array" }),
    }));
    expect(response.status).toBe(400);
  });
});
