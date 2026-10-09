import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

describe("mail drafts organization context", () => {
  for (const [name, path] of [
    ["drafts", "../src/app/mail/drafts/page.tsx"],
    ["compose", "../src/app/mail/compose/page.tsx"],
    ["approvals", "../src/app/mail/approvals/page.tsx"],
  ] as const) {
    it(`${name} uses the authenticated active organization`, () => {
      const source = read(path);
      expect(source).toContain("getAuthenticatedAppContext");
      expect(source).toContain("headers: await headers()");
      expect(source).toMatch(/context(?:\?\.|\.)organizationId/);
      expect(source).not.toContain("getDevOrgId");
      expect(source).not.toContain("ensureDevSeed");
    });
  }
});
