import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "../../../packages/db/src/email/repository.ts"), "utf8");

describe("mail repository schema contract", () => {
  it("uses canonical persisted sender and recipient columns", () => {
    expect(source).toContain("m.from_email");
    expect(source).toContain("m.from_name");
    expect(source).toContain("m.to_recipients");
    expect(source).not.toContain("m.from_address");
    expect(source).not.toContain("m.to_addresses");
  });

  it("uses canonical sent and attachment persistence", () => {
    expect(source).toContain("m.is_sent AS is_outbound");
    expect(source).toContain("FROM email_attachments ea");
    expect(source).not.toContain("m.has_attachments");
  });

  it("keeps organization scoping on inbox and thread reads", () => {
    expect(source).toContain("a.organization_id = $1");
    expect(source).toContain("a.organization_id = $2");
    expect(source).toContain("m.thread_id = $1");
  });

  it("keeps mail search parameterized", () => {
    expect(source).toContain("m.from_email ILIKE $${values.length}");
    expect(source).toContain("m.text_body ILIKE $${values.length}");
    expect(source).not.toContain("m.from_email ILIKE ${values.length}");
  });
});
