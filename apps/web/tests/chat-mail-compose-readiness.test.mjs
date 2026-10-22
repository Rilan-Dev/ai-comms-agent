import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mailComposeReadiness } from "../src/lib/mail/compose-readiness.ts";

test("connected mailbox plus enabled agent tools never overrides missing actor email.write", () => {
  const state = mailComposeReadiness({
    actorCanWrite: false, draftToolEnabled: true, sendRequestToolEnabled: true, hasBoundPrimaryMailbox: true,
  });
  assert.equal(state.canDraft, false);
  assert.equal(state.canRequestApproval, false);
  assert.deepEqual(state.blockers.map(item => item.code), ["missing_email_write"]);
  assert.match(state.blockers[0].message, /email\.write/);
  assert.match(state.blockers[0].message, /organization role/);
});

test("report independent allowlist, account and actor failures; no implicit permission elevation", () => {
  const none = mailComposeReadiness({
    actorCanWrite: false, draftToolEnabled: false, sendRequestToolEnabled: false, hasBoundPrimaryMailbox: false,
  });
  assert.deepEqual(none.blockers.map(item => item.code), [
    "missing_email_write", "draft_tool_disabled", "send_request_tool_disabled", "no_bound_primary_mailbox",
  ]);
  const draftOnly = mailComposeReadiness({
    actorCanWrite: true, draftToolEnabled: true, sendRequestToolEnabled: false, hasBoundPrimaryMailbox: true,
  });
  assert.equal(draftOnly.canDraft, true);
  assert.equal(draftOnly.canRequestApproval, false);
  assert.deepEqual(draftOnly.blockers.map(item => item.code), ["send_request_tool_disabled"]);
});

test("readiness is a pure GET diagnostic; chat test-email intent opens preview only", () => {
  const route = readFileSync(new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  const types = readFileSync(new URL("../../../packages/shared/src/identity/types.ts", import.meta.url), "utf8");
  assert.match(route, /mailComposeReadiness\(/);
  assert.match(route, /blockers: readiness\.blockers/);
  assert.match(route, /trusted\.subject\.permissions\.has\("email\.write"\)/);
  assert.match(chat, /setComposeBlockers\(/);
  assert.match(chat, /composeBlockers\.map\(/);
  assert.match(chat, /No draft has been saved/);
  assert.match(chat, /setDraft\(current =>/);
  assert.match(types, /SYSTEM_ROLE_PERMISSIONS/);
  assert.match(route, /const result = await invokeEmailReadTool\(/);
  assert.doesNotMatch(route, /decideEmailAction|sendDraft\(/);
});
