import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assistantEmailPreview } from "../src/lib/mail/assistant-email-preview.ts";

test("extracts only explicit assistant drafted subject and message body", () => {
  assert.deepEqual(assistantEmailPreview("Here is the email:\nSubject: Meeting update\nBody:\nHi team,\n\nThe meeting is at 2 PM.\nRegards,\nAlex"), {
    subject: "Meeting update", body: "Hi team,\n\nThe meeting is at 2 PM.\nRegards,\nAlex",
  });
  assert.deepEqual(assistantEmailPreview("**Subject:** Project news\n**Body:**\nHello!\n\nWe are on schedule."), {
    subject: "Project news", body: "Hello!\n\nWe are on schedule.",
  });
});

test("never treats a host denial, generic answer or unbounded text as a composed email", () => {
  for (const message of [
    "No email draft or send-approval request was confirmed by an authorized email tool.",
    "Security check (not an AI-generated send confirmation): Subject: Test\nBody:\nExample",
    "Subject: Hello",
    "Body:\nHello",
    "Subject: Here\nBody:\n",
    "Subject: Here\nBody:\n" + "x".repeat(20000),
    "Subject: \nBody:\nHello",
    "Subject: Meeting\nBody:\nI should not hallucinate a response.",
  ]) assert.equal(assistantEmailPreview(message), null, message.slice(0, 100));
});

test("Chat prefill reads last assistant draft only when preparing a new, unsaved review", () => {
  const client = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  const open = client.slice(client.indexOf("function openInlineEmailComposer()"), client.indexOf("function requestInlineEmailApproval()"));
  assert.match(open, /assistantEmailPreview\(latestAssistantReply\)/);
  assert.match(open, /if \(prepared && composeSubject === "Test Email" && composeBody === DEFAULT_COMPOSE_BODY\)/);
  assert.match(open, /setComposeSubject\(prepared\.subject\)/);
  assert.match(open, /setComposeBody\(prepared\.body\)/);
  assert.match(open, /if \(mailComposerOpen \|\| composeDraftId \|\| composeActionId\)/);
  assert.match(open, /explicitComposeRecipient\(latestUserRequest\)/);
  assert.doesNotMatch(open, /email\.send\.request|fetch\(/);
});
