import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

describe("Gmail OAuth platform configuration", () => {
  it("stores organization-scoped client configurations and encrypts client secrets", () => {
    const route = read("../src/app/api/settings/gmail-oauth/route.ts");
    expect(route).toContain("gmail_oauth_configs");
    expect(route).toContain("encryptCredential(clientSecret, key)");
    expect(route).toContain('role: "admin"');
    expect(route).not.toContain("GMAIL_OAUTH_CLIENT_SECRET");
    expect(route).not.toContain("return { clientSecret");
  });

  it("starts OAuth with the selected saved configuration, not environment client IDs", () => {
    const route = read("../src/app/api/oauth/gmail/start/route.ts");
    expect(route).toContain("loadGmailOAuthConfiguration(context.organizationId, configId)");
    expect(route).toContain("configId");
    expect(route).toContain("getAuthenticatedAppContext(request)");
    expect(route).not.toContain("GMAIL_OAUTH_CLIENT_ID");
    expect(route).not.toContain("SESSION_SIGNING_KEY");
  });

  it("uses the saved OAuth client at callback and stores client credentials encrypted with account tokens", () => {
    const callback = read("../src/app/api/oauth/gmail/callback/route.ts");
    expect(callback).toContain("loadGmailOAuthConfiguration(payload.organizationId, payload.configId)");
    expect(callback).toContain("oauth_client_id: clientId");
    expect(callback).toContain("oauth_client_secret: clientSecret");
    expect(callback).not.toContain("GMAIL_OAUTH_CLIENT_ID");
    expect(callback).not.toContain("SESSION_SIGNING_KEY");
  });

  it("provides a UI for managing multiple OAuth clients and selecting one to connect", () => {
    const settings = read("../src/app/settings/gmail-oauth-settings.tsx");
    const accounts = read("../src/app/mail/accounts/email-accounts-client.tsx");
    expect(settings).toContain("Add OAuth client");
    expect(settings).toContain("clientSecret");
    expect(settings).toContain("Gmail OAuth clients");
    expect(accounts).toContain("gmailConfigs.map");
    expect(accounts).toContain("configId=");
  });

  it("defines a tenant-scoped persistent OAuth client table", () => {
    const migration = read("../../../supabase/migrations/0025_gmail_oauth_configuration.sql");
    expect(migration).toContain("organization_id uuid NOT NULL REFERENCES organizations(id)");
    expect(migration).toContain("client_secret_ciphertext bytea NOT NULL");
    expect(migration).toContain("gmail_oauth_configs_org_enabled_idx");
  });
});
