import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@ai-comms-agent/shared";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  sameOrigin: vi.fn(),
  account: vi.fn(),
  query: vi.fn(),
  audit: vi.fn(),
  credential: vi.fn(),
  masterKey: vi.fn(),
  metaFetch: vi.fn(),
}));

vi.mock("@/lib/identity/repository", () => ({
  ensureDevSeed: async () => {},
  getIdentityAdapter: () => ({}),
  getIdentityRepository: () => ({}),
}));
vi.mock("@/lib/identity/authorization", async (original) => ({
  ...await original<object>(),
  authorize: mocks.authorize,
}));
vi.mock("@/lib/identity/local-auth", () => ({ assertSameOrigin: mocks.sameOrigin }));
vi.mock("@ai-comms-agent/db", () => ({
  getWhatsAppAccountForOrganization: mocks.account,
  listWhatsAppMessagesForOrganization: vi.fn(),
  query: mocks.query,
  recordAuditEvent: mocks.audit,
  loadWhatsAppCredential: mocks.credential,
  parseCredentialsMasterKey: mocks.masterKey,
}));

const organizationId = "10000000-0000-4000-8000-000000000001";
const accountId = "10000000-0000-4000-8000-000000000002";
const userId = "10000000-0000-4000-8000-000000000003";
const actionId = "10000000-0000-4000-8000-000000000004";
const to = "+919876543210";
const request = (method: "GET" | "POST", path: string, payload?: unknown) =>
  new Request("https://localhost" + path, {
    method,
    headers: { origin: "https://localhost", "content-type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
  });

describe("WhatsApp CHECK repair route behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("DATABASE_URL", "postgres://not-used-by-mocks/fixture");
    vi.stubEnv("CREDENTIALS_MASTER_KEY", "fixture-key-never-decrypted");
    mocks.authorize.mockResolvedValue({ user: { id: userId } });
    mocks.account.mockResolvedValue({ id: accountId, status: "connected", business_account_id: "test-waba" });
    mocks.credential.mockResolvedValue({ access_token: "fake-meta-token" });
    mocks.masterKey.mockReturnValue(Buffer.alloc(32));
    mocks.audit.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns HTTP 202 and stores valid E.164 only as pending human approval (no Meta send)", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: actionId, status: "pending" }] });
    vi.stubGlobal("fetch", mocks.metaFetch);
    const { POST } = await import("../src/app/api/whatsapp/messages/route");
    const res = await POST(request("POST", "/api/whatsapp/messages", {
      organizationId, accountId, to, body: "Approved? Not yet.",
    }));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ approvalRequired: true, actionId, status: "pending" });
    expect(mocks.authorize).toHaveBeenCalledWith(expect.any(Request), {
      organizationId, permission: "whatsapp.send",
    }, {}, {});
    expect(mocks.query).toHaveBeenCalledOnce();
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO whatsapp_send_actions");
    expect(sql).toContain("'pending'");
    expect(sql).toContain("ON CONFLICT (organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL");
    expect(params[3]).toBe(to);
    expect(params[4]).toBe("Approved? Not yet.");
    expect(mocks.audit).toHaveBeenCalledOnce();
    expect(mocks.metaFetch).not.toHaveBeenCalled();
  });

  it("rejects invalid E.164 phones without DB writes or any provider request", async () => {
    vi.stubGlobal("fetch", mocks.metaFetch);
    const { POST } = await import("../src/app/api/whatsapp/messages/route");
    for (const invalid of ["919876543210", "+019876543210", "+1234567", "+1234567890123456", "+12 345678"]) {
      const res = await POST(request("POST", "/api/whatsapp/messages", {
        organizationId, accountId, to: invalid, body: "Test only",
      }));
      expect(res.status).toBe(422);
    }
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.metaFetch).not.toHaveBeenCalled();
  });

  it("synchronizes valid Meta template names and statuses without messaging or approving locally", async () => {
    mocks.metaFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "meta-template-id", name: "order_update_2", language: "en_US",
            category: "UTILITY", status: "APPROVED", components: [{ type: "BODY", text: "Order update" }] },
        ],
      }),
    });
    vi.stubGlobal("fetch", mocks.metaFetch);
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: actionId, name: "order_update_2", status: "approved" }] });
    const { GET } = await import("../src/app/api/whatsapp/templates/route");
    const res = await GET(request("GET", "/api/whatsapp/templates?organizationId=" + organizationId + "&accountId=" + accountId));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ templates: [{ name: "order_update_2", status: "approved" }] });
    expect(mocks.authorize).toHaveBeenCalledWith(expect.any(Request), {
      organizationId, permission: "whatsapp.read",
    }, {}, {});
    expect(mocks.metaFetch).toHaveBeenCalledOnce();
    const [metaUrl, options] = mocks.metaFetch.mock.calls[0] as [URL, { headers: { authorization: string } }];
    expect(metaUrl.pathname).toContain("/message_templates");
    expect(options.headers.authorization).toBe("Bearer fake-meta-token");
    expect(mocks.query).toHaveBeenCalledTimes(2);
    const [insertSql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(insertSql).toContain("INSERT INTO whatsapp_templates");
    expect(params.slice(2, 7)).toEqual(["meta-template-id", "order_update_2", "en_US", "UTILITY", "approved"]);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("denies unauthorized requests before touching the DB or calling Meta", async () => {
    mocks.authorize.mockRejectedValue(new ForbiddenError("missing_permission"));
    vi.stubGlobal("fetch", mocks.metaFetch);
    const { POST } = await import("../src/app/api/whatsapp/messages/route");
    const { GET } = await import("../src/app/api/whatsapp/templates/route");
    const rejected = await POST(request("POST", "/api/whatsapp/messages", { organizationId, accountId, to, body: "No access" }));
    expect(rejected.status).toBe(403);
    const deniedSync = await GET(request("GET", "/api/whatsapp/templates?organizationId=" + organizationId + "&accountId=" + accountId));
    expect(deniedSync.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.metaFetch).not.toHaveBeenCalled();
  });

  it("fails closed on SQLSTATE 23514 without leaking a failing row into the HTTP response", async () => {
    mocks.query.mockRejectedValue(Object.assign(new Error("CHECK constraint failed"), {
      code: "23514", detail: "Failing row contains (+919876543210, private message)",
    }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("../src/app/api/whatsapp/messages/route");
    const res = await POST(request("POST", "/api/whatsapp/messages", { organizationId, accountId, to, body: "private message" }));
    expect(res.status).toBe(500);
    const response = JSON.stringify(await res.json());
    expect(response).toBe('{"error":"internal_server_error"}');
    expect(response).not.toContain(to);
    expect(response).not.toContain("private message");
    expect(spy).toHaveBeenCalledWith("[authorization] unexpected error", { sqlstate: "23514" });
  });
});
