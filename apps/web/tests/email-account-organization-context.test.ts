import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(__dirname, "../src/app/mail/accounts/page.tsx"),
  "utf8",
);

describe("email account organization context", () => {
  it("uses the authenticated user's active organization for mailbox queries", () => {
    expect(source).toContain("getAuthenticatedAppContext");
    expect(source).toContain('new Request("http://localhost", { headers: await headers() })');
    expect(source).toContain("const organizationId = context?.organizationId");
    expect(source).toContain("listForOrganization(organizationId)");
    expect(source).toContain("<EmailAccountsClient organizationId={organizationId}");
  });

  it("does not select or seed the development organization for a signed-in user", () => {
    expect(source).not.toContain("getDevOrgId");
    expect(source).not.toContain("ensureDevSeed");
  });
});
