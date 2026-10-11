import { describe, expect, it } from "vitest";
import { getEmailConnectionReadiness } from "./email-connection-readiness";

describe("email connection environment readiness", () => {
  it("fails closed when required server configuration is missing", () => {
    expect(getEmailConnectionReadiness({})).toEqual({
      databaseConfigured: false,
      credentialEncryptionConfigured: false,
      gmailOAuthConfigured: false,
      zohoOAuthConfigured: false,
      canPersistConnections: false,
    });
  });

  it("requires database and encryption before persistence can be enabled", () => {
    expect(getEmailConnectionReadiness({ DATABASE_URL: "postgres://configured" }).canPersistConnections).toBe(false);
    expect(
      getEmailConnectionReadiness({
        DATABASE_URL: "postgres://configured",
        CREDENTIALS_MASTER_KEY: "configured",
      }).canPersistConnections,
    ).toBe(true);
  });

  it("requires all OAuth fields for each provider", () => {
    expect(
      getEmailConnectionReadiness({
        GOOGLE_CLIENT_ID: "client",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_REDIRECT_URI: "https://example.test/callback",
      }).gmailOAuthConfigured,
    ).toBe(true);
    expect(
      getEmailConnectionReadiness({
        ZOHO_CLIENT_ID: "client",
        ZOHO_CLIENT_SECRET: "secret",
      }).zohoOAuthConfigured,
    ).toBe(false);
  });

  it("treats whitespace-only values as missing", () => {
    expect(getEmailConnectionReadiness({ DATABASE_URL: "   " }).databaseConfigured).toBe(false);
  });
});
