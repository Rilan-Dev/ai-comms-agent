import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path:string) => readFileSync(resolve(__dirname, path), "utf8");

describe("Activity/Audit/Operations product contracts", () => {
  it("keeps audit reads organization-authorized and server-filtered", () => {
    const route = read("../src/app/api/audit/route.ts");
    expect(route).toContain('permission: "audit.read"');
    expect(route).toContain('url.searchParams.get("eventType")');
    expect(route).toContain('url.searchParams.get("decision")');
    expect(route).toContain('url.searchParams.get("search")');
    expect(route).toContain('url.searchParams.get("from")');
    expect(route).toContain('url.searchParams.get("to")');
  });

  it("provides authorized JSON and CSV audit export", () => {
    const route = read("../src/app/api/audit/export/route.ts");
    expect(route).toContain('permission: "audit.read"');
    expect(route).toContain('format === "csv"');
    expect(route).toContain('Content-Disposition');
    expect(route).toContain("audit-export.csv");
    expect(route).toContain("audit-export.json");
  });

  it("keeps Operations scoped to an authorized organization", () => {
    const route = read("../src/app/api/operations/route.ts");
    expect(route).toContain('permission: "audit.read"');
    expect(route).toContain("organizationId");
    expect(route).toContain("email_errors_24h");
    expect(route).toContain("sync_failures_24h");
    expect(route).toContain("active_voice_sessions");
  });

  it("does not present fabricated Overview metrics", () => {
    const page = read("../src/app/page.tsx");
    expect(page).toMatch(/redirect\("\/(?:chat|overview)"\)/);
    expect(page).not.toContain("fakeMetrics");
    expect(page).not.toContain("mockData");
    expect(page).not.toContain("Good morning, Rilan.");
    expect(page).not.toContain("24 emails");
  });

  it("blocks automated email actions unless the account belongs to the org and is bound to the agent", () => {
    const executor = read("../../worker/src/agent/product-action-executor.ts");
    expect(executor).toContain("getForAgent");
    expect(executor).toContain("Email account is not owned by the organization or bound to this agent");
  });
});
