import { createSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@ai-comms-agent/db", () => ({ query: queryMock }));

import { POST } from "../src/app/api/webhooks/gmail/route";

// Public, isolated test fixture only; never used by an account.
const TEST_CERT = "-----BEGIN CERTIFICATE-----\nMIIDPTCCAiWgAwIBAgIUNfLtCBaaqciNmgVkj1mb1ZDuikswDQYJKoZIhvcNAQEL\nBQAwLjEsMCoGA1UEAwwjR21haWwgd2ViaG9vayBpc29sYXRlZCB0ZXN0IGZpeHR1\ncmUwHhcNMjYxMDIzMTg0NTM1WhcNMzYxMDIwMTg0NTM1WjAuMSwwKgYDVQQDDCNH\nbWFpbCB3ZWJob29rIGlzb2xhdGVkIHRlc3QgZml4dHVyZTCCASIwDQYJKoZIhvcN\nAQEBBQADggEPADCCAQoCggEBAKdIGnQd5XVZaAwfTSg3+d4PpbBoDpe8y9txcLdO\n2lA/AqeQx1XhqS91n7QcKWn2yKNQWSc9acQ8CrSu5u34WR+xtiD8YxJ5yM9pFIPL\n9EO3XSP3piUCrr+rce6Ur+qbuLCbgsIUCSJ/ucAOWVy5UTGkuT/OCbxgTx/v04SR\nSxx6KPvoSuFsQXEfsM/peAGn+XvwFLfFESFVWruS7cgGJOdoUv1vHghLAg0eFPKI\nUyzibqAkobvvDwvIexcXPO1LUQybe855EqeQ19Q21niEIUQpko6qCMAQmV/Zt97x\niL0DPioUmTwCcpN1KMx6LyIUa+CpM8ss9cbnVg+y1J7kv20CAwEAAaNTMFEwHQYD\nVR0OBBYEFDaYQuRAvGBqIKyni/7vAcK0neRqMB8GA1UdIwQYMBaAFDaYQuRAvGBq\nIKyni/7vAcK0neRqMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEB\nAKP+ApSy7Epy80oyVjWT4xtBtfa4I8jpbJoVRE+Urll0M3CsJnGx3FwZW5ghbbSk\n0Udv0SGFi4uiyLaoHLipGcR5LMKFsA6mT6SqJA4TXVcfXUddaVKjYvFHUwAbOJ//\nbQgS07i5lBNTJXiDTGwX6PZYUqLn51o4t93iRpEER0bvVRSFneRXeh3+zfoIMD0m\ndkdqaclhxEM3b+zoL8xv/RPmvQ2Eyl02eINY+o+IGnEyUIEZ+FrAmo12sNuG+dLO\nolLefXol84ObJ9/TaSOypJAlzeFoZTahSJoOj51YZA5DIJ1WFlQlai56cTqRSdM/\nfF2UJfQX1ADItsmL1q0z498=\n-----END CERTIFICATE-----\n";
// Public, isolated test fixture only; never used by an account.
const TEST_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCnSBp0HeV1WWgM\nH00oN/neD6WwaA6XvMvbcXC3TtpQPwKnkMdV4akvdZ+0HClp9sijUFknPWnEPAq0\nrubt+FkfsbYg/GMSecjPaRSDy/RDt10j96YlAq6/q3HulK/qm7iwm4LCFAkif7nA\nDllcuVExpLk/zgm8YE8f79OEkUsceij76ErhbEFxH7DP6XgBp/l78BS3xREhVVq7\nku3IBiTnaFL9bx4ISwINHhTyiFMs4m6gJKG77w8LyHsXFzztS1EMm3vOeRKnkNfU\nNtZ4hCFEKZKOqgjAEJlf2bfe8Yi9Az4qFJk8AnKTdSjMei8iFGvgqTPLLPXG51YP\nstSe5L9tAgMBAAECggEAGP3FrflVcY205LK8dTi/pLRTvaIeI/85uYQeIdSu+vQe\n8mfH0AXRn9yDyoW2jjUnTnbPivQ62+1YcBv9Nio3Lmv/WLg8GOOG463AOdx7lq5L\nRPdXpAndj5cOg2VFTtiK5B+njlUt9DB+0LmUEi1Bexgv8N9YRwNgbtYGlLScMxmz\nFZ6dPKzDq0tAZzhP5yOI8j839eyi9FugcUALJv0ijHZwNchtMtDS5dOc96nGbOpa\n4+lXBkcRyvYwsZ5aqvF8JqvrGyq/Huq+NmjFgUkZ4m4Bl6l5w35p+dFGZcO0vOFF\nP+2p/xUxe29NFw0mO5WUg74NH9HaxTcuySrOFiN9wQKBgQDcttCpAUDVfwmCTJ7S\nTw7cItftU0pcqWjK7A8Ys//dQc9qGpQUFsDwCcq2N7O2MwV6K/BDadr3d5OKbDg2\nN0SJOD24DVPNJZGb41qVBVLfk/A1gPYOq31dkNij93joyEmvyntxiucqF3ORuvcg\nCb4MZiqg/8A3z7aX7T9F31mAcQKBgQDCBnQJpLZoQenzJedkXztTNyblIjVk05QP\nq4ZU9a/ncDuTTZGevJeYd5yclcmnzwp7IJu6IX7zauVVSLdUEhWNBaaJPIjbGbp9\n4NVAKtRNLc7yYnfUMeglIjIYxDJoj/t3zcgdteLsOSfGwBXqjJ2X5OVObM0g7ZiL\nS/TfElWsvQKBgA9iTrj49WPsLuV+IbPW/topM5O/Mney9zLtsT+vjC4H4EUtBRVB\nYMFabV62Ezin5cHWPjD0t+Z31zjWwjRFNem6mdKyWxz5eWS8PBwW+ufKj/uquXvc\nSCi1Z+RF44+WJkyyeFg5rlMov01xEriQ9UY3+NCwAt3hBIEicD6Wis6BAoGAbFjY\nMY5mQgAU2a/f8D/xy/1vXeLleCFifAGnqQftq8sTqaVWXRMpgH3C2foXOvs1+h3y\neFU+JEYcPKy3m13h5Pcz0U0Zi2hpqOOFkiiYl2SuPNJZ4gfgf+QBn6zoDVXh8jva\ntSSdzJX6LVWUp37QfkLW/h1pyyqC1b6bxnnhl+0CgYAVFEA39gdH4BcW1UX59DQy\npb6fUSRYo5pF2MrqZ3JR33f/4uffDvw7iEx5Pjkn160AVh5b8cz7b+JrUKIKVUuG\nGaBaZI8BR++/8YAXdA2lvt0bgIWleQRWI+HXZJv7UnN1qHY2a5lSJ9cJggRksOpB\nMIcbMzsk0ASqL6iGtBCQ8w==\n-----END PRIVATE KEY-----\n";
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
