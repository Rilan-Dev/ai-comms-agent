import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { businessAnswerGuidance } from "../src/lib/chat/business-answer-guidance.ts";

test("business answer guide asks AI for concise, evidence-grounded hierarchy without inventing facts", () => {
  assert.match(businessAnswerGuidance, /direct answer/i);
  assert.match(businessAnswerGuidance, /Markdown/);
  assert.match(businessAnswerGuidance, /bold/);
  assert.match(businessAnswerGuidance, /action/i);
  assert.match(businessAnswerGuidance, /do not invent/i);
  assert.match(businessAnswerGuidance, /email/i);
  assert.match(businessAnswerGuidance, /emoji/i);
  assert.doesNotMatch(businessAnswerGuidance, /always list every message/i);
});

test("all model-based Chat paths use the same guide, without altering host verified reports", () => {
  const route = readFileSync(new URL("../src/app/api/chat/stream/route.ts", import.meta.url), "utf8");
  assert.match(route, /import \{ businessAnswerGuidance \}/);
  assert.match(route, /content: businessAnswerGuidance/);
  assert.match(route, /composeAssistantGuidance\(/);
  assert.match(route, /formatRollingMailSummary\(/);
  assert.match(route, /formatUnreadMailCountReport\(/);
  assert.match(route, /formatUnreadMailSummary\(/);
  assert.match(route, /appendConversationMessage\(/);
});
