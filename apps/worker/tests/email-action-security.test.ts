import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const attachmentSource = readFileSync(
  resolve(__dirname, "../src/email/attachment-service.ts"),
  "utf8",
);
const actionSource = readFileSync(
  resolve(__dirname, "../src/email/action-executor.ts"),
  "utf8",
);

describe("worker email security boundaries", () => {
  it("keeps attachment provider access in the worker", () => {
    expect(attachmentSource).toContain("retrieveEmailAttachment");
    expect(attachmentSource).toContain("organizationId");
    expect(attachmentSource).toContain("getMailMessageForOrganization");
    expect(attachmentSource).toContain("downloadAttachment(attachmentId)");
    expect(attachmentSource).toContain("MAX_EMAIL_ATTACHMENT_BYTES");
  });

  it("never accepts provider credentials from the browser boundary", () => {
    expect(attachmentSource).toContain("CREDENTIALS_MASTER_KEY");
    expect(attachmentSource).toContain("loadCredentials");
    expect(attachmentSource).not.toContain("Request");
    expect(attachmentSource).not.toContain("NextResponse");
  });

  it("sends an already-synchronized provider draft instead of creating a duplicate", () => {
    expect(actionSource).toContain("draft.provider_draft_id");
    expect(actionSource).toContain("connected.sendDraft(providerDraftId)");
    expect(actionSource).toContain("markLocalDraftSentForOrganization");
  });
});
