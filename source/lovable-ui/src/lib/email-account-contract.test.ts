import { describe, expect, it } from "vitest";
import {
  emailAccountActionInputSchema,
  emailAccountSummarySchema,
  listEmailAccountsInputSchema,
} from "./email-account-contract";

const account = {
  id: "account-1",
  organizationId: "org-1",
  provider: "gmail",
  emailAddress: "agent@example.com",
  status: "pending",
  createdAt: "2026-10-09T12:00:00.000Z",
  updatedAt: "2026-10-09T12:00:00.000Z",
};

describe("email account public contracts", () => {
  it("accepts a safe public account summary", () => {
    expect(emailAccountSummarySchema.parse(account)).toEqual(account);
  });

  it("rejects undeclared fields in a public account summary", () => {
    expect(() => emailAccountSummarySchema.parse({ ...account, secret: "not-public" })).toThrow();
  });

  it("preserves all provider identifiers from the source contract", () => {
    for (const provider of ["gmail", "zoho", "imap_smtp", "microsoft_graph"]) {
      expect(emailAccountSummarySchema.safeParse({
        ...account,
        provider,
      }).success).toBe(true);
    }
  });

  it("requires organization context", () => {
    expect(listEmailAccountsInputSchema.safeParse({ organizationId: "org-1" }).success).toBe(true);
    expect(listEmailAccountsInputSchema.safeParse({ organizationId: "" }).success).toBe(false);
  });

  it("rejects unsupported account actions", () => {
    expect(emailAccountActionInputSchema.safeParse({
      organizationId: "org-1",
      accountId: "account-1",
      action: "reconnect_imap_smtp",
    }).success).toBe(true);
    expect(emailAccountActionInputSchema.safeParse({
      organizationId: "org-1",
      action: "unknown",
    }).success).toBe(false);
  });
});
