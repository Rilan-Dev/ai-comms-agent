import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertOAuthRedirectUriSecure, getOAuthPublicOrigin, getOAuthRedirectUri } from "../src/lib/oauth/redirect-uri";
const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

describe("Zoho OAuth settings and dynamic callback", () => {
  it("builds callback URLs from the active request host without a static app URL", () => {
    const request = new Request("https://mail.example.com/api/settings/zoho-oauth?organizationId=org");
    expect(getOAuthRedirectUri(request, "gmail")).toBe("https://mail.example.com/api/oauth/gmail/callback");
    expect(getOAuthRedirectUri(request, "zoho")).toBe("https://mail.example.com/api/oauth/zoho/callback");
    expect(() => assertOAuthRedirectUriSecure("https://mail.example.com/api/oauth/zoho/callback")).not.toThrow();
  });
  it("prefers a validated public proxy origin over the internal localhost request URL", () => {
    const request = new Request("https://localhost:3000/api/settings/gmail-oauth", {
      headers: { "x-forwarded-host": "mail.example.com", "x-forwarded-proto": "https" },
    });
    expect(getOAuthPublicOrigin(request)).toBe("https://mail.example.com");
    expect(getOAuthRedirectUri(request, "gmail")).toBe("https://mail.example.com/api/oauth/gmail/callback");
    expect(getOAuthRedirectUri(request, "zoho")).toBe("https://mail.example.com/api/oauth/zoho/callback");
  });

  it("rejects missing or comma-separated proxy origin values instead of trusting a forwarding chain", () => {
    expect(() => getOAuthPublicOrigin(new Request("https://localhost:3000", {
      headers: { "x-forwarded-host": "mail.example.com, attacker.example" , "x-forwarded-proto": "https" },
    }))).toThrow(/single validated/);
    expect(() => getOAuthPublicOrigin(new Request("https://localhost:3000", {
      headers: { "x-forwarded-host": "mail.example.com" },
    }))).toThrow(/single validated/);
  });

  it("allows localhost HTTP for development but rejects public HTTP and raw IP callback hosts", () => {
    expect(() => assertOAuthRedirectUriSecure("http://localhost:3000/api/oauth/gmail/callback")).not.toThrow();
    expect(() => assertOAuthRedirectUriSecure("http://100.72.192.28:3300/api/oauth/gmail/callback")).toThrow(/raw IP/);
    expect(() => assertOAuthRedirectUriSecure("https://100.72.192.28:3300/api/oauth/gmail/callback")).toThrow(/raw IP/);
  });

  it("stores organization-scoped Zoho clients with encrypted secrets", () => {
    const route = read("../src/app/api/settings/zoho-oauth/route.ts");
    expect(route).toContain("zoho_oauth_configs");
    expect(route).toContain("encryptCredential(clientSecret, key)");
    expect(route).toContain('role: "admin"');
    expect(route).toContain("getOAuthRedirectUri(request, \"zoho\")");
    expect(route).not.toContain("ZOHO_OAUTH_CLIENT_SECRET");
  });
  it("uses the selected saved client and signed request-specific callback URI", () => {
    const start = read("../src/app/api/oauth/zoho/start/route.ts");
    const callback = read("../src/app/api/oauth/zoho/callback/route.ts");
    expect(start).toContain("getAuthenticatedAppContext(request)");
    expect(start).toContain("loadZohoOAuthConfiguration(context.organizationId, configId)");
    expect(start).toContain("redirect_uri: redirectUri");
    expect(start).toContain("configId");
    expect(start).not.toContain("NEXT_PUBLIC_APP_URL");
    expect(callback).toContain("loadZohoOAuthConfiguration(payload.organizationId, payload.configId)");
    expect(callback).toContain("redirect_uri: redirectUri");
    expect(callback).toContain("zoho_client_id: clientId");
    expect(callback).toContain("zoho_client_secret: clientSecret");
    expect(callback).not.toContain("ZOHO_OAUTH_CLIENT_SECRET");
  });
  it("uses the saved Zoho OAuth client for worker token refresh", () => {
    const adapter = read("../../../apps/worker/src/email/zoho-adapter.ts");
    expect(adapter).toContain("stored.zoho_client_id");
    expect(adapter).toContain("stored.zoho_client_secret");
    expect(adapter).not.toContain("process.env.ZOHO_OAUTH_CLIENT_ID");
    expect(adapter).not.toContain("process.env.ZOHO_OAUTH_CLIENT_SECRET");
  });
  it("exposes Zoho OAuth configuration and selection in Settings and Mail", () => {
    expect(read("../src/app/settings/page.tsx")).toContain("<ZohoOAuthSettings");
    expect(read("../src/app/settings/zoho-oauth-settings.tsx")).toContain("Add OAuth client");
    expect(read("../src/app/settings/zoho-oauth-settings.tsx")).toContain("X-Forwarded-Host");
    const accounts = read("../src/app/mail/accounts/email-accounts-client.tsx");
    expect(accounts).toContain("zohoConfigs.map");
    expect(accounts).toContain("selectedZohoConfig");
    expect(accounts).toContain("configId=");
  });
  it("defines the tenant-scoped Zoho OAuth configuration table", () => {
    const migration = read("../../../supabase/migrations/0027_zoho_oauth_configuration.sql");
    expect(migration).toContain("organization_id uuid NOT NULL REFERENCES organizations(id)");
    expect(migration).toContain("client_secret_ciphertext bytea NOT NULL");
    expect(migration).toContain("zoho_oauth_configs_org_enabled_idx");
  });
  it("derives callback origins from requests and requires HTTPS for public OAuth hosts", () => {
    const helper = read("../src/lib/oauth/redirect-uri.ts");
    expect(helper).toContain("new URL(request.url)");
    expect(helper).toContain("x-forwarded-host");
    expect(helper).toContain("x-forwarded-proto");
    expect(helper).toContain("assertOAuthRedirectUriSecure");
    expect(helper).toContain("url.protocol !== \"https:\"");
    expect(helper).not.toContain("process.env.NEXT_PUBLIC_APP_URL");
  });
});
