import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { paramsFromApprovedEmailSnapshot } from "../src/email/approved-email-draft";

const oneShot = readFileSync(new URL("../src/email/action-executor.ts", import.meta.url), "utf8");
const batch = readFileSync(new URL("../src/email/action-worker.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const draftRoute = readFileSync(new URL("../../../apps/web/src/app/api/mail/drafts/route.ts", import.meta.url), "utf8");

test("worker uses the immutable approval snapshot, never a mutable provider draft ID", () => {
  for (const [name, code] of [["batch", batch], ["one-shot", oneShot]] as const) {
    const start = code.indexOf('if (' + (name === "batch" ? 'action.actionType' : 'claimed.actionType') + ' === "send_email")');
    const end = code.indexOf('if (' + (name === "batch" ? 'action.actionType' : 'claimed.actionType') + ' === "reply_email")', start);
    const sending = code.slice(start, end);
    assert.ok(start >= 0 && end > start, name + " send block must exist");
    assert.match(sending, /paramsFromApprovedEmailSnapshot\(snapshot\)/);
    assert.match(sending, /await connected\.createDraft\(params\)/);
    assert.match(sending, /await connected\.sendDraft\(providerDraftId\)/);
    assert.doesNotMatch(sending, /draft\.provider_draft_id/);
    assert.doesNotMatch(sending, /connected\.updateDraft\(/);
    assert.match(sending, /String\(draft\.email_account_id\) !== (?:action|claimed)\.emailAccountId/);
  }
});

test("approved snapshot must have usable direct recipient and cannot fall back to current draft edits", () => {
  assert.deepEqual(paramsFromApprovedEmailSnapshot({
    to: ["alice@example.com"], cc: ["copy@example.com"], bcc: [],
    subject: "Reviewed subject", bodyText: "Reviewed body",
  }), { to: ["alice@example.com"], cc: ["copy@example.com"], bcc: [],
    subject: "Reviewed subject", body_text: "Reviewed body" });
  for (const snapshot of [
    { to: [], subject: "Reviewed", bodyText: "Text" },
    { to: null, subject: "Reviewed", bodyText: "Text" },
    { to: ["not-an-email"], subject: "Reviewed", bodyText: "Text" },
    { to: ["alice@example.com"], subject: null, bodyText: "Text" },
    { to: ["alice@example.com"], subject: "Reviewed", bodyText: null },
    { to: ["alice@example.com"], cc: ["invalid"], subject: "Reviewed", bodyText: "Text" },
  ]) assert.throws(() => paramsFromApprovedEmailSnapshot(snapshot), /approval snapshot/i);
});

test("all mutable draft updates and deletes reject pending, approved or executing send approvals", () => {
  const update = repository.slice(repository.indexOf("export async function updateLocalDraftForOrganization("), repository.indexOf("export async function listLocalDraftsForOrganization("));
  const deletion = repository.slice(repository.indexOf("export async function deleteLocalDraftForOrganization("), repository.indexOf("/** A page of real persisted email threads"));
  for (const [name, code] of [["update", update], ["delete", deletion]] as const) {
    assert.match(code, /NOT EXISTS \(/, name + " must reject locked drafts");
    assert.match(code, /email_actions ea/, name + " needs a tenant-scoped action check");
    assert.match(code, /ea\.organization_id = m\.organization_id/);
    assert.match(code, /ea\.draft_id = m\.id/);
    assert.match(code, /ea\.email_account_id = m\.email_account_id/);
    assert.match(code, /ea\.action_type = 'send_email'/);
    assert.match(code, /ea\.status IN \('pending_approval', 'approved', 'executing'\)/);
    assert.match(code, /ea\.expires_at IS NULL OR ea\.expires_at > now\(\)/);
  }
});

test("draft mutation APIs distinguish a locked approval from a missing tenant draft", () => {
  const patch = draftRoute.slice(draftRoute.indexOf("export async function PATCH"), draftRoute.indexOf("export async function GET"));
  const deletion = draftRoute.slice(draftRoute.indexOf("export async function DELETE"));
  for (const route of [patch, deletion]) {
    assert.match(route, /getLocalDraftForOrganization\(organizationId, messageId\)/);
    assert.match(route, /error: "draft_approval_locked"/);
    assert.match(route, /status: 409/);
    assert.match(route, /error: "not_found"/);
    assert.match(route, /status: 404/);
  }
});
