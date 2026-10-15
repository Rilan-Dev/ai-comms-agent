import { createSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@ai-comms-agent/db", () => ({ query: queryMock }));

import { POST } from "../src/app/api/webhooks/gmail/route";

const TEST_CERT = "-----BEGIN CERTIFICATE-----\nMIIDMzCCAhugAwIBAgIUQaDR6/IGUWRoVmqFLVBXbR3RupUwDQYJKoZIhvcNAQEL\nBQAwKTEnMCUGA1UEAwweR21haWwgUHViU3ViIHdlYmhvb2sgdGVzdCBvbmx5MB4X\nDTI2MTAxNTIyMjY0M1oXDTM2MTAxMjIyMjY0M1owKTEnMCUGA1UEAwweR21haWwg\nUHViU3ViIHdlYmhvb2sgdGVzdCBvbmx5MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\nMIIBCgKCAQEAkFXhk9rfe7oGTw7aZjy0xeX1yRVmyebK78FQkJCvUyqMyHhW1F7n\nG8uqaGyA9BcETvEeEZ7ZabHQZ4LQKvGRLloB1uoIRn/NMKFYJjlaSvzT1jg5xEZW\nQw1YmxSn+ZdLSV5Az/ZfdrT6vfu3eB0MdPytT9oP3jGfZoWZxUC8n6gatdnWMDSP\n6LWX3pCDAGGTqNcEVWAyNkAAdzVFVPtxez5WF2iBBt8VzuidNHHVxSvhgI/CJMEy\nQufNLV3uWUHZXhfGocFQOnchLx5x8/U2mSDbhQHV7gSI9T+m0BzovUg7rfEZtkiy\nyn3XIJTyzXerWdyiYnE98VHWvzbRPv3IFQIDAQABo1MwUTAdBgNVHQ4EFgQUcBHC\n25vyQC3s36n0qUCX99sKAEgwHwYDVR0jBBgwFoAUcBHC25vyQC3s36n0qUCX99sK\nAEgwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAfw4Ch8S2FXmm\nCyhqELQN4p8GmFpxQficik3H1nCQTobazueQY8v3dxH0kTOB/OYdlLka0N9P1WHS\nhqXTlSnmCRPXoMlFIN4zGUj4Cr13oPPQlKPFMXEg7J/ccWZwta1VZVwxnSs+w2RN\niQgcfuDK2qymWfiKQ+qa7zxJMsv2LF6Yr/pGGs7/YBrqBxeREPIvdBePrUgtQLET\n/pVwk02CK9gMR7irR4k/HtWR4pmeh/hV83GD3kw5aG/ICNIYTCpaEh7+ry6mn7Kd\nBMMqLuLJrIwbIRz5I9WlqcDjhZG0XraOHv6DuG1/mlCU+qL3c4+dfPKrg8fKVY+1\nW2RhNDWhUw==\n-----END CERTIFICATE-----";
const TEST_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCQVeGT2t97ugZP\nDtpmPLTF5fXJFWbJ5srvwVCQkK9TKozIeFbUXucby6pobID0FwRO8R4RntlpsdBn\ngtAq8ZEuWgHW6ghGf80woVgmOVpK/NPWODnERlZDDVibFKf5l0tJXkDP9l92tPq9\n+7d4HQx0/K1P2g/eMZ9mhZnFQLyfqBq12dYwNI/otZfekIMAYZOo1wRVYDI2QAB3\nNUVU+3F7PlYXaIEG3xXO6J00cdXFK+GAj8IkwTJC580tXe5ZQdleF8ahwVA6dyEv\nHnHz9TaZINuFAdXuBIj1P6bQHOi9SDut8Rm2SLLKfdcglPLNd6tZ3KJicT3xUda/\nNtE+/cgVAgMBAAECggEAGJ2c+CNm4+oI82i8FJ2b0vhyH5Y3zo0+5P7aJ52VWSCz\nm+jyHgwFbDci2+ZNY9OdF32FvEmUGLOLsGud5wUF1prhH28QdD2NmBKcPwCfBpTx\n5+H08CVyxsK67s/qCeYkn+GkOhNxmoQpE0eftat2mWkSgcDV3fYmkkyMuhhdUvkN\n4GXg0bXU3Yxf+wgkNSr4PXA1DxuyZK3cd4wwRg+xAXvUDiTmmz7vBiYDLh4hO3Gp\n91ELfMEgwcfFXnpRyH0SX72dMLXaySKjKoF71ay3kHJ7udPNf6VmhOS9YjXQYd/j\nOcY1rvpgOUXV1lfdX2hCyaui0jnduAR6VbH4tiezLQKBgQDHieHjli2bOiwU5tY2\n2TobBlqUdP4t8vkDxd5gGmadQeLvIwXPfNaJMyewVQgMUiVtlWi84M0uI2pRAt2P\njVKbGZ8yxRnW5iGOaU5OLR6yl9tYHlU2YisUPn476kOuKYa1Sop3s15CPuXokA29\nwkAPNpKYhLURSaLGUEo8VPs9MwKBgQC5LTYDVMXfMGAck6I4PfxPd3Ba6XVh0ViY\n2BQKzxHoPQCql19mqX3KII0bxwk834wuUC64ioHCI18t624ziPdPA8RYn9HV1vJ1\nxdIxfiCgyrCWG061aNTNdfoB5/88dmL5Zd1VsLv2YegSMwpFe5fwv1k8U8R3jemB\n8UPKnxqVlwKBgCwCvn8LJb4CI6zsiT0JxqYlTZ9G+rU5zTDG2NiLmix/VsV2DRcJ\nquwSC2P6LU9CYxz7gmF+l+LgTtfVcPbzrc+l5BY3oQ5kLeyST4Iws3+ivO9/qT3Y\ngzXw3rjqX8kvQZYE/euO9XBZHS6hb1ZPmP18yIT7mV+y7zxOnGASjWUCgYATHIHa\n97zRi97Bw0dqvFQk/4L464uKNdEqxp6i/dGpqqJbfYD9/LkyfBW/Sgq5HBLNiFQ3\nLcaTPr7QlerkvXp5xCWHHG3SvO9iBnK10jHbepONUafU57cM7ZQw+vttAP8BY84w\nGqBCygp/WimyZJdgrI0BiHakk971ORhPGQ51/Q==\n-----END PRIVATE KEY-----";
const TEST_AUDIENCE = "https://app.example.test/api/webhooks/gmail";
const TEST_SERVICE_ACCOUNT = "push@example.iam.gserviceaccount.com";
let previousAudience: string | undefined;
let previousServiceAccount: string | undefined;

function signToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-key" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com",
    aud: TEST_AUDIENCE,
    email: TEST_SERVICE_ACCOUNT,
    email_verified: true,
    iat: now,
    exp: now + 3600,
    ...overrides,
  })).toString("base64url");
  const unsigned = header + "." + claims;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return unsigned + "." + signer.sign(TEST_PRIVATE_KEY).toString("base64url");
}

function request(token: string, body: string) {
  return new Request("https://app.example.test/api/webhooks/gmail", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body,
  });
}

function pubSubBody(payload: unknown) {
  return JSON.stringify({
    message: {
      data: Buffer.from(JSON.stringify(payload)).toString("base64"),
      messageId: "test-message-1",
    },
    subscription: "projects/test/subscriptions/gmail-push",
  });
}

describe("Gmail Pub/Sub webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previousAudience = process.env.GMAIL_PUBSUB_PUSH_AUDIENCE;
    previousServiceAccount = process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT;
    process.env.GMAIL_PUBSUB_PUSH_AUDIENCE = TEST_AUDIENCE;
    process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT = TEST_SERVICE_ACCOUNT;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ "test-key": TEST_CERT }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
    })));
  });

  it("rejects requests without a bearer token", async () => {
    const response = await POST(new Request("https://app.example.test/api/webhooks/gmail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("rejects malformed bearer tokens", async () => {
    const response = await POST(request("not-a-jwt", "{}"));
    expect(response.status).toBe(401);
  });

  it.each([
    { label: "wrong audience", claims: { aud: "https://attacker.example/" } },
    { label: "wrong service account", claims: { email: "attacker@example.com" } },
    { label: "unverified service account", claims: { email_verified: false } },
    { label: "expired token", claims: { exp: 1 } },
    { label: "wrong issuer", claims: { iss: "https://attacker.example/" } },
    { label: "future-issued token", claims: { iat: Math.floor(Date.now() / 1000) + 600 } },
  ] as Array<{ label: string; claims: Record<string, unknown> }>)("rejects a correctly signed token with $label", async ({ claims }) => {
    const response = await POST(request(signToken(claims), "{}"));
    expect(response.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid notification payload after authenticating the push", async () => {
    const response = await POST(request(signToken(), pubSubBody({ emailAddress: "not-an-email", historyId: "bad" })));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_notification" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed Pub/Sub envelope", async () => {
    const response = await POST(request(signToken(), JSON.stringify({ message: { messageId: "missing-data" } })));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_pubsub_envelope" });
  });

  it("does not create sync state for an unknown mailbox", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const response = await POST(request(signToken(), pubSubBody({ emailAddress: "unknown@example.com", historyId: "123" })));
    expect(response.status).toBe(404);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (previousAudience === undefined) delete process.env.GMAIL_PUBSUB_PUSH_AUDIENCE;
    else process.env.GMAIL_PUBSUB_PUSH_AUDIENCE = previousAudience;
    if (previousServiceAccount === undefined) delete process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT;
    else process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT = previousServiceAccount;
  });

  it("does not create sync state for an ambiguous mailbox", async () => {
    queryMock.mockResolvedValueOnce({ rows: [
      { id: "account-1", organization_id: "org-1", history_id: "100", sync_status: "idle" },
      { id: "account-2", organization_id: "org-2", history_id: "100", sync_status: "idle" },
    ] });
    const response = await POST(request(signToken(), pubSubBody({ emailAddress: "user@example.com", historyId: "123" })));
    expect(response.status).toBe(404);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("does not queue a paused mailbox", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "account-1", organization_id: "org-1", history_id: "100", sync_status: "paused" }] });
    const response = await POST(request(signToken(), pubSubBody({ emailAddress: "user@example.com", historyId: "123" })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ skipped: "sync_paused" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates notifications already covered by the stored history cursor", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "account-1", organization_id: "org-1", history_id: "123", sync_status: "idle" }] });
    const response = await POST(request(signToken(), pubSubBody({ emailAddress: "user@example.com", historyId: "123" })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ already_reconciled: true });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("queues a new Gmail history ID durably", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "account-1", organization_id: "org-1", history_id: "100", sync_status: "idle" }] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await POST(request(signToken(), pubSubBody({ emailAddress: "user@example.com", historyId: "123" })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1]![0]).toContain("pending_push_at");
  });
});
