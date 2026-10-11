import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(__dirname, "../src/app/ai-voice/page.tsx"),
  "utf8",
);

describe("AI voice workspace organization context", () => {
  it("loads agents from the authenticated user's active organization", () => {
    expect(source).toContain("getAuthenticatedAppContext");
    expect(source).toContain('new Request("http://localhost", { headers: await headers() })');
    expect(source).toContain("const organizationId = context?.organizationId");
    expect(source).toContain("new PostgresAgentRepository().list(organizationId)");
    expect(source).toContain("<VoiceWorkspace organizationId={organizationId}");
  });

  it("does not seed or select the development organization for a signed-in user", () => {
    expect(source).not.toContain("getDevOrgId");
    expect(source).not.toContain("ensureDevSeed");
  });
});
