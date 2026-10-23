import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeManualComposeSnapshot, matchesManualComposeReview } from "../src/lib/mail/manual-compose-review";

const composer = readFileSync(new URL("../src/app/mail/compose/compose-client.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../src/app/api/mail/actions/route.ts", import.meta.url), "utf8");

const saved = {
  to: ["ALICE@example.com"], cc: ["cc@example.com"], bcc: [],
  subject: "Reviewed", bodyText: "Approved body",
};

describe("FIX-01 manual email compose must approve only the reviewed persisted draft", () => {
  it("canonicalizes the exact recipient and text snapshot without changing the body", () => {
    expect(normalizeManualComposeSnapshot(saved)).toEqual({
      to: ["alice@example.com"], cc: ["cc@example.com"], bcc: [],
      subject: "Reviewed", bodyText: "Approved body",
    });
    expect(matchesManualComposeReview(saved, { ...saved, bodyText: "Changed after review" })).toBe(false);
    expect(matchesManualComposeReview(saved, { ...saved, to: ["attacker@example.org"] })).toBe(false);
    expect(matchesManualComposeReview(saved, { ...saved, cc: ["new-cc@example.org"] })).toBe(false);
    expect(matchesManualComposeReview(saved, { ...saved, subject: "Changed" })).toBe(false);
    expect(matchesManualComposeReview(saved, saved)).toBe(true);
  });

  it("rejects incomplete or malformed review snapshots without asserting false approval", () => {
    expect(matchesManualComposeReview(saved, null)).toBe(false);
    expect(matchesManualComposeReview(saved, { ...saved, to: "alice@example.com" })).toBe(false);
    expect(matchesManualComposeReview(saved, { ...saved, to: [] })).toBe(false);
    expect(matchesManualComposeReview(saved, { ...saved, bodyText: null })).toBe(false);
    expect(matchesManualComposeReview(saved, { ...saved, bcc: ["invalid"] })).toBe(false);
  });

  it("requires a confirmed save before approving edited contents, without an asynchronous autosave race", () => {
    expect(composer).toContain("const [reviewedSnapshot, setReviewedSnapshot]");
    expect(composer).toContain("setReviewedSnapshot(null)");
    expect(composer).toContain("const canRequestApproval");
    expect(composer).toContain("matchesManualComposeReview");
    expect(composer).toContain("expectedSnapshot: reviewedSnapshot");
    expect(composer).toContain("if (!canRequestApproval || !draftId || !reviewedSnapshot || draftOperationRef.current?.revision === scopeRevisionRef.current)");
    expect(composer).toContain("scopeRevisionRef.current !== operationRevision");
    expect(composer).toContain("draftOperationRef.current");
    expect(composer).not.toContain("setTimeout(() => { void saveDraft(); }, 900)");
    expect(composer).not.toContain("if (!draftId) {\n      await saveDraft();\n      return;");
  });

  it("never overrides loaded draft sender with the default mailbox and keeps existing drafts on their original sender", () => {
    expect(composer).toContain("setAccountId(current => current || first?.id ||");
    expect(composer).toContain("disabled={busy || loadingDraft || !scopeValid || Boolean(draftId)");
    expect(composer).toContain("requestedDraftId && !draftId");
  });

  it("server rejects reviewed content that no longer matches the persisted draft", () => {
    expect(actions).toContain("matchesManualComposeReview(snapshot, body.expectedSnapshot)");
    expect(actions).toContain('error: "draft_review_changed"');
    expect(actions).toContain("status: 409");
    expect(actions).toContain("const action = await createEmailAction({");
  });
});
