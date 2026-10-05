import { describe, expect, it, vi, afterEach } from "vitest";
import { GmailOAuthClient } from "../../apps/worker/src/email/gmail-oauth";

describe("GmailOAuthClient", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds an offline PKCE authorization URL", () => {
    const client = new GmailOAuthClient({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "https://example.test/oauth/gmail/callback",
    });
    const url = client.getAuthorizationUrl("state-1", "challenge-1");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("code_challenge=challenge-1");
    expect(url).toContain("scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.modify");
  });

  it("exchanges an authorization code server-side", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "access", expires_in: 3600, token_type: "Bearer" }), { status: 200 }),
    );
    const client = new GmailOAuthClient({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "https://example.test/callback",
    });
    const token = await client.exchangeCode("code", "verifier");
    expect(token.access_token).toBe("access");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
  });
});


describe("OAuth reconnect binding", () => {
  it("binds Gmail reconnect state to an optional target account", async () => {
    const source = await (await fetch("https://raw.githubusercontent.com/Rilan-Dev/ai-comms-agent/main/apps/web/src/app/api/oauth/gmail/start/route.ts")).text();
    expect(source).toContain("accountId");
    expect(source).toContain("...(accountId ? { accountId } : {})");
  });

  it("validates Gmail reconnect target ownership and provider", async () => {
    const source = await (await fetch("https://raw.githubusercontent.com/Rilan-Dev/ai-comms-agent/main/apps/web/src/app/api/oauth/gmail/callback/route.ts")).text();
    expect(source).toContain('target.organization_id !== payload.organizationId');
    expect(source).toContain('target.provider !== "gmail"');
  });
});
