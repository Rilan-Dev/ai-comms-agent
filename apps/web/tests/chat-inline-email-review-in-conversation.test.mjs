import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");

test("email review renders inside the scrollable conversation after assistant messages, never in the top bar", () => {
  const header = chat.slice(chat.indexOf("<header "), chat.indexOf("</header>"));
  assert.doesNotMatch(header, />Compose email<\/button>/);
  const log = chat.indexOf('<div ref={messageScrollRef} role="log"');
  const assistant = chat.indexOf('messages.map((message) => (', log);
  const inlineReview = chat.indexOf('{mailComposerOpen && !voiceOpen && !agentSwitchBusy && (', log);
  const action = chat.indexOf('{activitySteps.length > 0 ?', log);
  assert.ok(log > 0 && assistant > log && inlineReview > assistant && action > inlineReview,
    "host-owned email review follows messages inside the Chat log");
  assert.doesNotMatch(chat.slice(0, log), /<h2[^>]*>Review an email draft<\/h2>/);
  assert.match(chat.slice(inlineReview, action), /ref=\{mailComposerReviewRef\}/);
  assert.match(chat.slice(inlineReview, action), /Email ready for review in Chat/);
  assert.match(chat.slice(inlineReview, action), /\{composeNotice && <p[^>]*>\{composeNotice\}<\/p>\}/);
  assert.match(chat.slice(inlineReview, action), /aria-label="Email recipient"/);
  assert.match(chat.slice(inlineReview, action), /aria-label="Email body"/);
});

test("preparation opens the inline email card without silently saving or sending", () => {
  const prepare = chat.slice(chat.indexOf('function openInlineEmailComposer()'), chat.indexOf('async function sendMessage()'));
  assert.match(prepare, /explicitComposeRecipient\(latestUserRequest\)/);
  assert.match(prepare, /void openMailComposer\(suggestedRecipient \?\? ""\)/);
  assert.match(prepare, /requestInlineEmailApproval/);
  assert.doesNotMatch(prepare, /fetch\(|sendDraft\(|\.send\(/);
  assert.match(chat, /onRequestEmailApproval=\{requestInlineEmailApproval\}/);
});

test("inline draft lifecycle uses only verified draft and approval endpoints with safe notices", () => {
  const start = chat.indexOf('{mailComposerOpen && !voiceOpen && !agentSwitchBusy && (', chat.indexOf('<div ref={messageScrollRef} role="log"'));
  const end = chat.indexOf('{activitySteps.length > 0 ?', start);
  const card = chat.slice(start, end);
  assert.match(card, /onClick=\{\(\) => void submitMailCompose\("draft"\)\}/);
  assert.match(card, /onClick=\{\(\) => void submitMailCompose\("request_approval"\)\}/);
  assert.match(card, /disabled=\{composeBusy \|\| !composeCanDraft/);
  assert.match(card, /disabled=\{composeBusy \|\| !composeCanApprove/);
  assert.match(card, /InlineMailApprovalReview/);
  assert.match(card, /Mail permissions/);
  assert.match(card, /No email was sent/);
  assert.match(chat, /window\.confirm\("Request approval to send the saved draft/);
  assert.match(route, /invokeEmailReadTool\(runtime, toolName, input, context\)/);
  assert.match(route, /"email\.draft\.create"/);
  assert.match(route, /"email\.send\.request"/);
  assert.doesNotMatch(route, /\.send\(|sendDraft\(/);
});

test("Chat email review changes do not create a second email-send route", () => {
  assert.match(chat, /fetch\("\/api\/chat\/mail-compose", \{/);
  assert.match(chat, /const revision = composeRevisionRef\.current/);
  assert.match(chat, /if \(revision !== composeRevisionRef\.current \|\| epoch !== agentContextEpochRef\.current\) return/);
  assert.match(chat, /if \(data\.status !== "pending_approval"/);
  assert.doesNotMatch(chat, /fetch\("\/api\/email\/send"/);
});
