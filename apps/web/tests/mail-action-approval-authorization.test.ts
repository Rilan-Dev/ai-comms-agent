import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const actions = readFileSync(new URL("../src/app/api/mail/actions/route.ts", import.meta.url), "utf8");
const composer = readFileSync(new URL("../src/app/mail/compose/compose-client.tsx", import.meta.url), "utf8");
const draftApi = readFileSync(new URL("../src/app/api/mail/drafts/route.ts", import.meta.url), "utf8");
const post = actions.slice(actions.indexOf("export async function POST"), actions.indexOf("export async function PATCH"));
const patch = actions.slice(actions.indexOf("export async function PATCH"), actions.indexOf("export async function GET"));
const get = actions.slice(actions.indexOf("export async function GET"));

describe("FIX-01 separate request permission from privileged human email approval", () => {
  it("a user granted email.write may request review without organization admin permission", () => {
    expect(post).toContain('permission: "email.write"');
    expect(post).not.toContain('permission: "organization.update"');
    expect(draftApi).toContain('permission: "email.write"');
    expect(composer).toContain('actionType: "send_email"');
    expect(post).toContain("requestedBy: subject.user.id");
    expect(post).toContain("createEmailAction({");
  });
  it("a human approval or rejection remains privileged, never implicitly granted to email.write", () => {
    expect(patch).toContain('permission: "organization.update"');
    expect(patch).not.toContain('permission: "email.write"');
    expect(patch).toContain("decideEmailAction(");
    expect(get).toContain('permission: "organization.update"');
    expect(patch).toContain("assertSameOrigin(request)");
  });
  it("a request still needs same-tenant draft, valid recipients, a verified review, and no provider send", () => {
    expect(post).toContain("assertSameOrigin(request)");
    expect(post).toContain("getMailMessageForOrganization(organizationId, draftId)");
    expect(post).toContain("String(draft.email_account_id) !== emailAccountId");
    expect(post).toContain("const to = validRecipients(draft.to_recipients)");
    expect(post).toContain("if (to.length === 0 || to.length !== (Array.isArray(draft.to_recipients)");
    expect(post).toContain('error: "invalid_action_recipients"');
    expect(post).toContain("matchesManualComposeReview(snapshot, body.expectedSnapshot)");
    expect(post).not.toContain("connected.sendDraft");
    expect(post).not.toContain("decideEmailAction(");
  });
});
