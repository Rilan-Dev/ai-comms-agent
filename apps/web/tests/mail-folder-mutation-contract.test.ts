import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = readFileSync(resolve(__dirname, "../../../../packages/db/src/email/repository.ts"), "utf8");
const route = readFileSync(resolve(__dirname, "../src/app/api/mail/messages/folder/route.ts"), "utf8");

describe("mail folder mutation contract", () => {
  it("archives only through an organization-scoped archive folder", () => {
    expect(repository).toContain("f.role = 'archive'");
    expect(repository).toContain("a.organization_id = $1");
    expect(repository).toContain("m.id = ANY($2::uuid[])");
  });

  it("moves only within the same email account", () => {
    expect(repository).toContain("f.id = $2 AND f.email_account_id = a.id");
    expect(repository).toContain("m.id = ANY($3::uuid[])");
  });

  it("does not expose folder mutation without organization authorization", () => {
    expect(route).toContain('permission: "organization.update"');
    expect(route).toContain('["archive", "move"]');
  });

  it("rejects partial mutation success instead of silently dropping inaccessible messages", () => {
    expect(route).toContain("updated !== messageIds.length");
  });
});
