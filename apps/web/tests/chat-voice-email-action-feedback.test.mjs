import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deniedEmailWriteExplanation, verifiedEmailToolSummary } from "../src/lib/mail/action-feedback.ts";

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
    assert.match(denied ?? "", /human approval/);
  }
});

test("non-actions and legitimate write grants do not trigger deterministic denial", () => {
  const missing = new Set(["organization.read", "email.read"]);
  for (const prompt of ["read my inbox", "how can I send email?", "who sent this message?", "send me a summary of today's meetings"]) {
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
  assert.match(source, /await appendConversationMessage\(/);
  assert.match(source, /emit\("done", \{ conversationId: conversation\.id, provider, model, toolCalls:/);
  assert.match(source, /status: toolOutput\?\.status/);
  assert.match(source, /permissions\.includes\(tool\.required_permission\)/);
});

test("voice SSE and JSON use the same authoritative actor permission denial", () => {
  const source = read("../src/app/api/voice/turn/route.ts");
  assert.match(source, /deniedEmailWriteExplanation\(transcript, subject\.permissions\)/);
  assert.match(source, /await saveAnswer\(blockedWriteExplanation\)/);
  assert.match(source, /emit\("delta", \{ text: blockedWriteExplanation \}\)/);
  assert.match(source, /toolCalls: \[\], pendingApprovals: \[\]/);
  assert.match(source, /runEmailAgentTurn\(/);
});
