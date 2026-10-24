import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = readFileSync(resolve(__dirname, "../../../packages/db/src/email/repository.ts"), "utf8");
const route = readFileSync(resolve(__dirname, "../src/app/api/mail/messages/folder/route.ts"), "utf8");

describe("mail folder mutation contract", () => {
  it("archives only through an organization-scoped archive folder", () => {
    expect(repository).toContain("f.role = 'archive'");
    expect(repository).toContain("a.organization_id = $1");
    expect(repository).toContain("m.id = ANY($2::uuid[])");
  });

  it("moves all selected messages only if every message belongs to the destination mailbox", () => {
    expect(repository).toContain("WHERE f.id = $2 AND a.organization_id = $1 AND a.deleted_at IS NULL");
    expect(repository).toContain("const destinationRow = destination.rows[0]");
    expect(repository).toContain("if (!destinationRow || destination.rows.length !== 1");
    expect(repository).toContain("destinationRow.email_account_id !== accounts[0]");
    expect(repository).toContain("targets = [destinationRow]");
    expect(repository).toContain("m.email_account_id = target.email_account_id");
    expect(repository).toContain("m.id = ANY($2::uuid[])");
  });

  it("never commits a partial archive or move after a missing or inaccessible message", () => {
    expect(repository).toContain("withTransaction(async (client) =>");
    expect(repository).toContain("FOR UPDATE OF m");
    expect(repository).toContain("if (selected.rows.length !== ids.length) return 0");
    expect(repository).toContain("if (update.rows.length !== ids.length)");
    expect(repository).toContain("transaction rolled back");
  });

  it("does not expose folder mutation without organization authorization", () => {
    expect(route).toContain('permission: "organization.update"');
    expect(route).toContain('["archive", "move"]');
  });

  it("rejects partial mutation success instead of silently dropping inaccessible messages", () => {
    expect(route).toContain("updated !== messageIds.length");
  });
});
