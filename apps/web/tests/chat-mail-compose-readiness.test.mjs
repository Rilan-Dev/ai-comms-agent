import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mailComposeReadiness, selectPreferredComposeMailbox } from "../src/lib/mail/compose-readiness.ts";

test("connected mailbox plus enabled agent tools never overrides missing actor email.write", () => {
  const state = mailComposeReadiness({
    actorCanWrite: false, draftToolEnabled: true, sendRequestToolEnabled: true, hasBoundPrimaryMailbox: true, providerCanDraft: true, providerCanSend: true,
  });
  assert.equal(state.canDraft, false);
  assert.equal(state.canRequestApproval, false);
  assert.deepEqual(state.blockers.map(item => item.code), ["missing_email_write"]);
  assert.match(state.blockers[0].message, /email\.write/);
  assert.match(state.blockers[0].message, /organization role/);
});

test("report independent allowlist, account and actor failures; no implicit permission elevation", () => {
  const none = mailComposeReadiness({
    actorCanWrite: false, draftToolEnabled: false, sendRequestToolEnabled: false, hasBoundPrimaryMailbox: false, providerCanDraft: true, providerCanSend: true,
  });
  assert.deepEqual(none.blockers.map(item => item.code), [
    "missing_email_write", "draft_tool_disabled", "send_request_tool_disabled", "no_bound_primary_mailbox",
  ]);
  const draftOnly = mailComposeReadiness({
    actorCanWrite: true, draftToolEnabled: true, sendRequestToolEnabled: false, hasBoundPrimaryMailbox: true, providerCanDraft: true, providerCanSend: true,
  });
  assert.equal(draftOnly.canDraft, true);
  assert.equal(draftOnly.canRequestApproval, false);
  assert.deepEqual(draftOnly.blockers.map(item => item.code), ["send_request_tool_disabled"]);
});

test("readiness GET and explicit manual compose remain review-only and never send", () => {
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


test("mailbox draft capability is required even when actor, binding and policy are enabled", () => {
  const state = mailComposeReadiness({
    actorCanWrite: true, draftToolEnabled: true, sendRequestToolEnabled: true,
    hasBoundPrimaryMailbox: true, providerCanDraft: false, providerCanSend: true,
  });
  assert.equal(state.canDraft, false);
  assert.equal(state.canRequestApproval, false);
  assert.deepEqual(state.blockers.map(x => x.code), ["provider_drafts_unsupported"]);
});

test("mailbox send capability independently blocks approval but not draft creation", () => {
  const state = mailComposeReadiness({
    actorCanWrite: true, draftToolEnabled: true, sendRequestToolEnabled: true,
    hasBoundPrimaryMailbox: true, providerCanDraft: true, providerCanSend: false,
  });
  assert.equal(state.canDraft, true);
  assert.equal(state.canRequestApproval, false);
  assert.deepEqual(state.blockers.map(x => x.code), ["provider_send_unsupported"]);
});

test("readiness is specific to the selected bound mailbox, never true for every account from one capable account", () => {
  const route = readFileSync(new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  assert.match(route, /a\.capabilities/);
  assert.match(route, /mailboxes\.map\(mailbox =>/);
  assert.match(route, /providerCanDraft: mailbox\.capabilities\.drafts === true/);
  assert.match(route, /providerCanSend: mailbox\.capabilities\.send === true/);
  assert.match(route, /canDraft: readiness\.canDraft/);
  assert.match(route, /canRequestApproval: readiness\.canRequestApproval/);
  assert.match(chat, /setComposeCanDraft\(selectedMailbox\?\.canDraft === true\)/);
  assert.match(chat, /setComposeCanApprove\(selectedMailbox\?\.canRequestApproval === true\)/);
  assert.match(chat, /setComposeBlockers\(selectedMailbox\?\.blockers \?\? \[\]\)/);
});


test("prefer a mailbox capable of both drafting and send approval over earlier draft-only choices", () => {
  const accounts = [
    { id: "draft-only", canDraft: true, canRequestApproval: false },
    { id: "complete", canDraft: true, canRequestApproval: true },
    { id: "blocked", canDraft: false, canRequestApproval: false },
  ];
  assert.equal(selectPreferredComposeMailbox(accounts)?.id, "complete");
  assert.equal(selectPreferredComposeMailbox([accounts[0], accounts[2]])?.id, "draft-only");
  assert.equal(selectPreferredComposeMailbox([accounts[2]])?.id, "blocked");
  assert.equal(selectPreferredComposeMailbox([]), undefined);
});

test("GET readiness and chat default mailbox selection share the full-workflow preference", () => {
  const route = readFileSync(new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  assert.match(route, /selectPreferredComposeMailbox\(choices\)/);
  assert.match(chat, /selectPreferredComposeMailbox\(mailboxes\)/);
  assert.match(chat, /setComposeCanDraft\(selectedMailbox\?\.canDraft === true\)/);
  assert.match(chat, /setComposeCanApprove\(selectedMailbox\?\.canRequestApproval === true\)/);
  assert.match(route, /canRequestApproval: preferred\?\.canRequestApproval \?\? empty\.canRequestApproval/);
});
