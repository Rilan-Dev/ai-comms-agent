import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryPath = resolve(__dirname, "../../../packages/db/src/email/repository.ts");
const source = readFileSync(repositoryPath, "utf8");

describe("Postgres email account repository contract", () => {
  it("maps the persisted email_account_status enum without legacy active/expired assumptions", () => {
    expect(source).toContain('status === "connected" ? "connected"');
    expect(source).toContain('status === "pending" ? "pending"');
    expect(source).not.toContain('status === "active" ? "connected"');
    expect(source).not.toContain('status === "expired" ? "pending"');
  });

  it("never returns soft-deleted accounts through normal account reads", () => {
    expect(source).toContain("WHERE id = $1 AND deleted_at IS NULL");
    expect(source).toContain("WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC");
  });

  it("clears a stale connection error when a mailbox is restored", () => {
    expect(source).toContain("last_error = NULL");
    expect(source).toContain("connected_at = COALESCE(connected_at, now())");
  });
});
