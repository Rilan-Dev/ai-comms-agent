import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deniedEmailWriteExplanation, isExplicitEmailMutationRequest, unverifiedEmailActionExplanation, verifiedEmailToolSummary } from "../src/lib/mail/action-feedback.ts";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("imperative send/draft/forward requests are denied safely when actor has no email.write", () => {
  const permissions = new Set(["organization.read", "email.read"]);
  for (const prompt of [
    "send email to test@example.com for test email",
    "Please send a test email to test@example.com",
    "draft an email to test@example.com",
    "could you forward this email?",
    "request send approval for my draft",
  ]) {
    const denied = deniedEmailWriteExplanation(prompt, permissions);
    assert.match(denied ?? "", /email\.write/);
    assert.match(denied ?? "", /No email was sent/);
    assert.match(denied ?? "", /human (?:must approve|approval)/i);
  }
});

test("non-actions and legitimate write grants do not trigger deterministic denial", () => {
  const missing = new Set(["organization.read", "email.read"]);
  for (const prompt of ["read my inbox", "how can I send email?", "who sent this message?", "send me a summary of today's meetings", "send me a summary of emails received today", "send me the list of messages"]) {
    assert.equal(deniedEmailWriteExplanation(prompt, missing), null, prompt);
  }
  assert.equal(deniedEmailWriteExplanation("send email to test@example.com", new Set(["email.write"])), null);
});

test("verified tool summary distinguishes draft, pending approval and denial without claiming delivery", () => {
  const summary = verifiedEmailToolSummary([
    { name: "email.draft.create", ok: true, status: "draft_created" },
    { name: "email.send.request", ok: true, status: "pending_approval" },
    { name: "email.draft.update", ok: false, errorCode: "tool_not_allowed", status: "denied" },
  ]);
  assert.match(summary, /draft saved/i);
  assert.match(summary, /approval request pending/i);
  assert.match(summary, /tool_not_allowed/);
  assert.match(summary, /No email was sent/i);
  assert.equal(verifiedEmailToolSummary([{ name: "email.messages.list", ok: true, readOnly: true }]), "");
  assert.match(verifiedEmailToolSummary([{ name: "email.reply.draft", ok: true, status: "reply_draft_created" }]), /draft saved/i);
  assert.match(verifiedEmailToolSummary([{ name: "email.forward.draft", ok: true, status: "forward_draft_created" }]), /draft saved/i);
  assert.equal(verifiedEmailToolSummary([]), "");
});

test("chat sends natural-language commands to the AI stream, not a silent direct compose preflight", () => {
  const client = read("../src/app/chat/chat-client.tsx");
  const send = client.slice(client.indexOf("async function sendMessage()"), client.indexOf("\n  return (", client.indexOf("async function sendMessage()")));
  assert.match(send, /fetch\("\/api\/chat\/stream"/);
  assert.doesNotMatch(send, /parseTestEmailComposeRequest/);
  assert.doesNotMatch(send, /openMailComposer\(/);
  assert.match(client, /\/api\/chat\/mail-compose/); // explicit review UI retained
});

test("chat stream returns durable, verified tool results and denied explanation", () => {
  const source = read("../src/app/api/chat/stream/route.ts");
  assert.match(source, /deniedEmailWriteExplanation\(content, subject\.permissions\)/);
  assert.match(source, /verifiedEmailToolSummary\(toolTurn\.toolCalls\)/);
  assert.match(source, /assistantOutput = verifiedSummary \|\| \(explicitEmailAction \? unverifiedEmailActionExplanation\(\) : toolTurn\.text\)/);
  assert.match(source, /await appendConversationMessage\(/);
  assert.match(source, /emit\("done", \{ conversationId: conversation\.id, provider, model, toolCalls:/);
  assert.match(source, /const verifiedStatus = toolOutput\?\.status/);
  assert.match(source, /if \(blockedWriteExplanation\) \{[\s\S]*?\} else if \(toolTurn\)/);
  assert.match(source, /emit\("delta", \{ text: assistantOutput \}\)/);
  assert.match(source, /permissions\.includes\(tool\.required_permission\)/);
});

test("voice SSE and JSON use the same authoritative actor permission denial", () => {
  const source = read("../src/app/api/voice/turn/route.ts");
  assert.match(source, /deniedEmailWriteExplanation\(transcript, subject\.permissions\)/);
  assert.match(source, /await saveAnswer\(blockedWriteExplanation\)/);
  assert.match(source, /emit\("delta", \{ text: blockedWriteExplanation \}\)/);
  assert.match(source, /toolCalls: \[\], pendingApprovals: \[\]/);
  assert.match(source, /runEmailAgentTurn\(/);
  assert.match(source, /voiceAnswer = verifiedSummary \|\| \(explicitEmailAction \? unverifiedEmailActionExplanation\(\) : turn\.text\)/);
});

test("explicit email mutation intents include natural requests but not requests for information", () => {
  for (const phrase of [
    "send email to test@example.com for test email",
    "can you send an email to test@example.com",
    "I need you to send a test email to test@example.com",
    "I want you to draft an email to test@example.com",
    "please forward this email to the team",
    "could you reply to this message",
  ]) {
    assert.equal(isExplicitEmailMutationRequest(phrase), true, phrase);
    assert.match(deniedEmailWriteExplanation(phrase, new Set(["email.read"])) ?? "", /No email was sent/);
  }
  for (const phrase of [
    "send me a summary of emails",
    "send me the list of messages",
    "what is the process to send email?",
    "how can I forward an email?",
    "read emails from last week",
  ]) {
    assert.equal(isExplicitEmailMutationRequest(phrase), false, phrase);
  }
  assert.match(unverifiedEmailActionExplanation(), /No email was sent/);
  assert.match(unverifiedEmailActionExplanation(), /no .*approval request/i);
});

test("a send request without a host-confirmed mutation never displays a speculative model success", () => {
  const chat = read("../src/app/api/chat/stream/route.ts");
  const voice = read("../src/app/api/voice/turn/route.ts");
  const client = read("../src/app/chat/chat-client.tsx");
  assert.match(chat, /const explicitEmailAction = isExplicitEmailMutationRequest\(content\)/);
  assert.match(chat, /onSafeReadOnlyFinal: explicitEmailAction \? undefined : async/);
  assert.match(chat, /verifiedSummary \|\| \(explicitEmailAction \? unverifiedEmailActionExplanation\(\) : toolTurn\.text\)/);
  assert.match(chat, /if \(explicitEmailAction\) \{[\s\S]*?unverifiedEmailActionExplanation\(\)/);
  assert.match(voice, /const explicitEmailAction = isExplicitEmailMutationRequest\(transcript\)/);
  assert.match(voice, /onSafeReadOnlyFinal: explicitEmailAction \? undefined : async/);
  assert.match(voice, /verifiedSummary \|\| \(explicitEmailAction \? unverifiedEmailActionExplanation\(\) : turn\.text\)/);
  assert.match(voice, /verifiedSummary \|\| \(explicitEmailAction \? unverifiedEmailActionExplanation\(\) : result\.text\)/);
  assert.match(client, /fetch\("\/api\/chat\/stream"/);
});

test("outgoing email command variants cannot bypass the shared chat/voice write-result gate", () => {
  const noWrite = new Set(["organization.read", "email.read"]);
  for (const prompt of [
    "send emails to customer@example.com",
    "Send these messages to customer@example.com",
    "Please email customer@example.com about a test",
    "Could you respond to this email?",
    "I need you to send the emails to customer@example.com",
    "send daily summaries of my inbox to manager@example.com",
    "write to customer@example.com about the meeting",
    "I want to send an email to customer@example.com",
    "I would like to send an email to customer@example.com",
    "I\u0027d like to draft an email to customer@example.com",
    "Can you please send an email to customer@example.com",
  ]) {
    assert.equal(isExplicitEmailMutationRequest(prompt), true, prompt);
    assert.match(deniedEmailWriteExplanation(prompt, noWrite) ?? "", /No email was sent/, prompt);
    assert.equal(deniedEmailWriteExplanation(prompt, new Set(["email.write"])), null, prompt);
  }
});

test("read-only email requests remain read-only when natural phrasing includes send", () => {
  for (const prompt of [
    "send me the emails received yesterday",
    "send me those messages from last week",
    "send me a summary of emails received today",
    "send me the list of messages",
    "how can I respond to an email?",
    "can you tell me whether customer@example.com sent mail?",
  ]) {
    assert.equal(isExplicitEmailMutationRequest(prompt), false, prompt);
  }
});

test("verified email denials explain a safe next step rather than only showing internal error codes", () => {
  const reasons = [
    ["permission_denied", /email\.write permission/],
    ["tool_not_allowed", /agent's saved email tool policy/],
    ["account_not_available", /connected primary mailbox/],
    ["capability_not_supported", /provider capabilities/],
    ["approval_required", /human approval workflow/],
  ];
  for (const [errorCode, expected] of reasons) {
    const answer = verifiedEmailToolSummary([
      { name: "email.send.request", ok: false, errorCode },
    ]);
    assert.match(answer, expected, String(errorCode));
    assert.match(answer, /No email was sent/);
    assert.doesNotMatch(answer, /email was sent successfully/i);
  }
  const message = verifiedEmailToolSummary([
    { name: "email.send.request", ok: false, errorCode: "unexpected_private_error" },
  ]);
  assert.match(message, /Email tool denied/);
  assert.doesNotMatch(message, /private_error/);
});

test("successful draft and send-approval request give distinct next human steps", () => {
  const draft = verifiedEmailToolSummary([{ name: "email.draft.create", ok: true, status: "draft_created" }]);
  const approval = verifiedEmailToolSummary([{ name: "email.send.request", ok: true, status: "pending_approval" }]);
  assert.match(draft, /review the draft/i);
  assert.match(approval, /Mail.*Approvals/i);
  assert.match(approval, /No email was sent/);
});
