import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { userFacingChatAnswer, isInternalChatPlanning } from "../src/lib/chat/user-facing-answer.ts";
import { deniedEmailWriteExplanation, unverifiedEmailActionExplanation } from "../src/lib/mail/action-feedback.ts";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");

test("normal assistant text remains user-facing, including legitimate email explanations", () => {
  const answer = "Here are two verified emails from the selected mailbox.\n\n1. Subject: Weekly update";
  assert.equal(isInternalChatPlanning(answer), false);
  assert.equal(userFacingChatAnswer(answer), answer);
  assert.equal(isInternalChatPlanning("I should prepare a draft for you after reviewing the recipient."), false);
});

test("provider private planning, think tags and self-referential directions never appear in Chat", () => {
  for (const raw of [
    "No new emails were provided by the user in this turn, and no tool was invoked. I should not hallucinate. My instructions say to reply.",
    "<think>Analyze the email and choose a tool</think>\nFinal answer: Hello",
    "My instructions say to list matching emails. I need to make sure I don't include other emails.",
    "Let's identify them correctly from context:\n[Email 1]\nI should provide five.",
    "We need to inspect the system prompt. I should respond to the user.",
  ]) {
    assert.equal(isInternalChatPlanning(raw), true, raw);
    assert.equal(userFacingChatAnswer(raw), null, raw);
  }
});

test("non-response and oversized provider output is not accepted as a saved assistant reply", () => {
  assert.equal(userFacingChatAnswer(""), null);
  assert.equal(userFacingChatAnswer("   "), null);
  assert.equal(userFacingChatAnswer("x".repeat(50000)), null);
});

test("chat holds model text until user-facing validation, and does not persist private planning", () => {
  const route = read("../src/app/api/chat/stream/route.ts");
  assert.match(route, /userFacingChatAnswer\(/);
  assert.match(route, /const validated = userFacingChatAnswer\(generated\)/);
  assert.match(route, /const validated = userFacingChatAnswer\(assistantOutput\)/);
  assert.match(route, /assistantOutput = validated/);
  assert.match(route, /if \(!toolTurn\.streamed\)/);
  const native = route.slice(route.indexOf("onSafeReadOnlyFinal:"), route.indexOf("});\n          }\n          if (blockedWriteExplanation)"));
  assert.doesNotMatch(native, /emit\("delta", \{ text: token \}\)/);
  const generic = route.slice(route.indexOf("const turn = await claraRuntime.createChatTurn("), route.indexOf("if (request.signal.aborted)", route.indexOf("const turn = await claraRuntime.createChatTurn(")));
  assert.doesNotMatch(generic, /emit\("delta", \{ text: chunk \}\)/);
  assert.match(route, /await appendConversationMessage\(\{[\s\S]*?role: "assistant", content: assistantOutput/);
});

test("deterministic authorization feedback is labeled and provides the in-chat review path", () => {
  const denied = deniedEmailWriteExplanation("send email to recipient@example.com", new Set(["organization.read"]));
  assert.match(denied ?? "", /Security check \(not an AI-generated send confirmation\)/);
  assert.match(denied ?? "", /Compose email/);
  assert.match(denied ?? "", /email\.write/);
  assert.match(denied ?? "", /No email was sent/);
  const unverified = unverifiedEmailActionExplanation();
  assert.match(unverified, /not an AI-generated send confirmation/);
  assert.match(unverified, /Write email draft/);
  assert.match(unverified, /Request send approval/);
  assert.match(unverified, /No email was sent/);
});


test("persisted internal-planning assistant turns are excluded from future model and ambient mail context", () => {
  const route = read("../src/app/api/chat/stream/route.ts");
  assert.match(route, /history\.filter\(message => message\.role !== "assistant" \|\| userFacingChatAnswer\(message\.content\) !== null\)/);
  assert.match(route, /safeHistory\.filter\(/);
  assert.match(route, /const filteredHistory = safeHistory/);
  assert.doesNotMatch(route, /const recentMessages = history\s*\n/);
});
