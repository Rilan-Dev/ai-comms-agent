import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateDraftWrite } from "../src/lib/mail/draft-write-validation";

const api = readFileSync(new URL("../src/app/api/mail/drafts/route.ts", import.meta.url), "utf8");
describe("FIX-01: complete draft recipient validation", () => {
  it("keeps the exact reviewed body and normalizes all addresses", () => {
    expect(validateDraftWrite({ to: [" Alice+tag@Example.com "], cc: [], bcc: [], subject: "Subject", bodyText: "  Exact body\n" }, "create")).toEqual({
      ok: true, fields: { to: ["alice+tag@example.com"], cc: [], bcc: [], subject: "Subject", bodyText: "  Exact body\n" },
    });
    expect(validateDraftWrite({ to: ["valid@example.com"] }, "create").ok).toBe(true);
    expect(validateDraftWrite({ subject: "Updated" }, "patch")).toEqual({ ok: true, fields: { subject: "Updated" } });
    expect(validateDraftWrite({ cc: [] }, "patch")).toEqual({ ok: true, fields: { cc: [] } });
  });
  it("rejects all invalid members rather than dropping one recipient", () => {
    for (const mode of ["create", "patch"] as const) {
      for (const bad of ["not-an-email", "a@example.com\r\nBcc:evil@example.com", "a@example.com,b@example.com", "alice@invalid", "x".repeat(321)]) {
        expect(validateDraftWrite({ to: ["good@example.com", bad] }, mode).ok).toBe(false);
      }
      for (const bad of [{ to: ["good@example.com", 123] }, { to: [] }, { cc: ["broken"] }, { bcc: ["<script>"] }]) {
        expect(validateDraftWrite(bad, mode).ok).toBe(false);
      }
    }
  });
  it("rejects wrong-typed provided fields, overflow and empty updates", () => {
    for (const mode of ["create", "patch"] as const) {
      for (const bad of [
        { to: "valid@example.com" }, { to: null }, { cc: null }, { bcc: "foo@example.com" },
        { subject: 123 }, { bodyText: null }, { subject: "S".repeat(999) },
        { bodyText: "x".repeat(100001) }, { cc: Array.from({ length: 101 }, () => "x@example.com") },
      ]) expect(validateDraftWrite(bad, mode).ok).toBe(false);
    }
    expect(validateDraftWrite({}, "patch").ok).toBe(false);
    expect(validateDraftWrite({ cc: [] }, "create").ok).toBe(false);
  });
  it("applies the validator at both authenticated manual draft mutation boundaries", () => {
    expect(api).toContain('validateDraftWrite(body, "create")');
    expect(api).toContain('validateDraftWrite(body, "patch")');
    expect(api).toContain('error: "invalid_draft_payload"');
    expect(api).not.toContain('body.to.filter(');
    expect(api).not.toContain('body?.to.filter(');
    expect(api).toContain('permission: "email.write"');
    expect(api).toContain("updateLocalDraftForOrganization(");
    expect(api).toContain("createLocalDraft(");
  });
});
