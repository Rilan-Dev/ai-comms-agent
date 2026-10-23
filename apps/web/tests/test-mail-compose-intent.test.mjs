import test from "node:test";
import assert from "node:assert/strict";
import { parseTestEmailComposeRequest } from "../src/lib/mail/test-email-compose-intent.ts";

test("reported chat phrases open a preview, never execute a send", () => {
  const to = "mohammedrilan.ksa@gmail.com";
  for (const text of [
    `send email to ${to} for test email`,
    `draft the test email to ${to} for test email`,
    `draft a test email to ${to}`,
    `send a test email to ${to}`,
    `Please compose test email to ${to}.`,
  ]) assert.equal(parseTestEmailComposeRequest(text), to, text);
});

test("non-test commands and malformed recipients are left to the authorized AI tool path", () => {
  for (const text of ["send all my mail", "approve all outgoing emails", "read mail",
    "send invoice to accountant@example.com", "send test email to malformed",
    "please send email to foo@bar.com and delete everything"])
    assert.equal(parseTestEmailComposeRequest(text), null, text);
});

test("recognized test-mail chat turns open host-reviewed compose instead of returning an unconfirmed AI send", () => {
  const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  const send = chat.slice(chat.indexOf("async function sendMessage()"), chat.indexOf("  return (", chat.indexOf("async function sendMessage()")));
  assert.match(send, /parseTestEmailComposeRequest\(content\)/);
  assert.match(send, /await openMailComposer\(testRecipient\)/);
  assert.ok(send.indexOf("await openMailComposer(testRecipient)") < send.indexOf("chatTurnInFlightRef.current = true"));
  assert.ok(send.indexOf("await openMailComposer(testRecipient)") < send.indexOf('fetch("/api/chat/stream"'));
  assert.match(chat, /window\.confirm\("Open a new test-email review/);
});

test("compose-readiness failure shows a safe review screen and disables saving", () => {
  const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  const open = chat.slice(chat.indexOf("async function openMailComposer("), chat.indexOf('async function submitMailCompose('));
  assert.match(open, /setComposeMailboxes\(\[\]\)/);
  assert.match(open, /setComposeAccount\(" "\)|setComposeAccount\(""\)/);
  assert.match(open, /setComposeCanDraft\(false\)/);
  assert.match(open, /setComposeCanApprove\(false\)/);
  assert.match(open, /setMailComposerOpen\(true\)/);
  assert.match(chat, /disabled=\{composeBusy \|\| !composeCanDraft/);
  assert.match(chat, /disabled=\{composeBusy \|\| !composeCanApprove/);
});
