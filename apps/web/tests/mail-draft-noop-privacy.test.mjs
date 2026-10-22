import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { hasDraftChanges } from "../src/lib/mail/draft-update-validation.ts";

test("an empty PATCH body never authorizes a draft update or a generic message read", () => {
  for (const body of [
    null, undefined, {}, { organizationId: "org", messageId: "regular-mail" },
    { to: "invalid string" }, { cc: null }, { subject: 123 }, { bodyText: false },
    { is_read: true, forwarded: true },
  ]) assert.equal(hasDraftChanges(body), false);
});

test("recognized editable draft fields still support deliberate changes", () => {
  for (const body of [
    { to: ["user@example.org"] }, { to: [] }, { cc: [] }, { bcc: [] },
    { subject: "" }, { bodyText: "" }, { subject: "Proposal", bodyText: "Hello" },
  ]) assert.equal(hasDraftChanges(body), true);
});

test("route rejects an empty/invalid draft patch before any message lookup", () => {
  const route = readFileSync(new URL("../src/app/api/mail/drafts/route.ts", import.meta.url), "utf8");
  const start = route.indexOf("export async function PATCH(request: Request)");
  const end = route.indexOf("export async function GET(request: Request)", start);
  assert.ok(start > 0 && end > start);
  const patch = route.slice(start, end);
  assert.match(patch, /if \(!hasDraftChanges\(body\)\)/);
  assert.match(patch, /error: "no_draft_changes"/);
  assert.match(patch, /status: 422/);
  assert.ok(patch.indexOf("hasDraftChanges(body)") < patch.indexOf("updateLocalDraftForOrganization("));
});

test("repository cannot return a non-draft message on a zero-column update", () => {
  const repo = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
  const start = repo.indexOf("export async function updateLocalDraftForOrganization(");
  const end = repo.indexOf("export async function listLocalDraftsForOrganization(", start);
  assert.ok(start >= 0 && end > start);
  const update = repo.slice(start, end);
  assert.match(update, /if \(!sets\.length\) return null;/);
  assert.doesNotMatch(update, /if \(!sets\.length\) return getMailMessageForOrganization/);
  assert.match(update, /m\.is_draft = true/);
  assert.match(update, /m\.organization_id = \$\{organizationParam\}/);
});
