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

test("recognized test-mail chat turns always reach the AI stream and return an assistant result", () => {
  const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  const begin = chat.indexOf("async function sendMessage()");
  const end = chat.indexOf("\n  const interactiveControlsDisabled", begin);
  assert.ok(begin >= 0 && end > begin);
  const send = chat.slice(begin, end);
  assert.doesNotMatch(send, /parseTestEmailComposeRequest\(content\)/);
  assert.doesNotMatch(send, /openMailComposer\(testRecipient\)/);
  assert.match(send, /chatTurnInFlightRef\.current = true/);
  assert.match(send, /fetch\("\/api\/chat\/stream"/);
  assert.match(send, /readSseEvents\(response\.body\)/);
  assert.match(send, /role: "assistant"/);
  assert.match(send, /if \(!completed\) throw new Error/);
  // The separate manual compose workflow remains available for reviewed
  // drafts and request approvals. No send is authorized by this test.
  assert.match(chat, /function openInlineEmailComposer\(/);
  assert.match(chat, /Save email draft/);
  assert.match(chat, /Request send approval/);
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
  assert.match(chat, /composeDiscoveryFailed && <p/);
  assert.match(chat, /!composeMailboxes\.length && !composeDiscoveryFailed/);
});
