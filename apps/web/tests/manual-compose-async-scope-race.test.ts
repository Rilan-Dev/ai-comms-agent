import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/app/mail/compose/compose-client.tsx", import.meta.url), "utf8");
const load = src.slice(src.indexOf("  useEffect(() => {"), src.indexOf("  const recipients = "));
const save = src.slice(src.indexOf("  async function saveDraft()"), src.indexOf("  async function requestSendApproval()"));
const approval = src.slice(src.indexOf("  async function requestSendApproval()"), src.indexOf("  return <main"));

describe("FIX-01 manual mail composer async scope and review guards", () => {
  it("rejects earlier draft loads when organization or draft selection changes", () => {
    expect(src).toContain("scopeRef.current = scopeKey");
    expect(src).toContain("const scopeValid = formScope === scopeKey");
    expect(load).toContain("const controller = new AbortController()");
    expect(load).toContain("signal: controller.signal");
    expect(load).toContain("scopeRef.current !== scopeKey");
    expect(load).toContain("return () => controller.abort()");
    expect(load).toContain("setDraftId(null)");
    expect(load).toContain("setReviewedSnapshot(null)");
    expect(load).toContain("setApprovalId(null)");
    expect(load).toContain("setFormScope(scopeKey)");
  });

  it("ignores old mailbox discovery after organization switch", () => {
    expect(load).toContain("organizationRef.current !== organizationId");
    expect(load).toContain("controller.signal.aborted");
    expect(load).toContain("setAccounts(items)");
    expect(load).toContain("return () => controller.abort()");
  });

  it("cannot save or approve the previous draft while new navigation is pending", () => {
    expect(src).toContain("scopeValid &&");
    expect(save).toContain("if (!scopeValid");
    expect(save).toContain("scopeRef.current !== scopeKey");
    expect(approval).toContain("if (!canRequestApproval");
    expect(approval).toContain("scopeRef.current !== scopeKey");
    expect(src).toContain("disabled={busy || loadingDraft || !scopeValid");
  });
});
