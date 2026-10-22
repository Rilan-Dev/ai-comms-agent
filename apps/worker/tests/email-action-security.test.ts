import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    assert.equal(attachmentSource.includes("retrieveEmailAttachment"), true);
    assert.equal(attachmentSource.includes("organizationId"), true);
    assert.equal(attachmentSource.includes("getMailMessageForOrganization"), true);
    assert.equal(attachmentSource.includes("downloadAttachment(attachmentId)"), true);
    assert.equal(attachmentSource.includes("MAX_EMAIL_ATTACHMENT_BYTES"), true);
  });

  it("never accepts provider credentials from the browser boundary", () => {
    assert.equal(attachmentSource.includes("CREDENTIALS_MASTER_KEY"), true);
    assert.equal(attachmentSource.includes("loadCredentials"), true);
    assert.equal(attachmentSource.includes("Request"), false);
    assert.equal(attachmentSource.includes("NextResponse"), false);
  });

  it("sends the approved immutable snapshot instead of a mutable synchronized provider draft", () => {
    assert.equal(actionSource.includes("paramsFromApprovedEmailSnapshot(snapshot)"), true);
    assert.equal(actionSource.includes("connected.createDraft(params)"), true);
    assert.equal(actionSource.includes("connected.sendDraft(providerDraftId)"), true);
    assert.equal(actionSource.includes("draft.provider_draft_id"), false);
    assert.equal(actionSource.includes("markLocalDraftSentForOrganization"), true);
  });
});
