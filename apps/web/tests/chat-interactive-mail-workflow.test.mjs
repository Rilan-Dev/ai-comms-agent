import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const chat = file("../src/app/chat/chat-client.tsx");
const controls = file("../src/app/chat/interactive-message-controls.tsx");
const catalog = file("../src/lib/chat/interactive-replies.ts");
const composeRoute = file("../src/app/api/chat/mail-compose/route.ts");

test("an assistant mail answer exposes reviewed compose and send-approval controls", () => {
  assert.match(catalog, /export function hasInteractiveEmailActions\(/);
  assert.match(controls, /export function InteractiveMailActions\(/);
  assert.match(controls, /Write email draft/);
  assert.match(controls, /Request send approval/);
  assert.match(controls, /hasInteractiveEmailActions\(answer, userRequest\)/);
  assert.match(controls, /<InteractiveMailActions/);
  assert.match(chat, /<SuggestedNextActions/);
  assert.match(chat, /onComposeEmail=\{openInlineEmailComposer\}/);
  assert.match(chat, /onRequestEmailApproval=\{requestInlineEmailApproval\}/);
});

test("inline actions reuse existing draft-save then request-approval flow", () => {
  assert.match(chat, /async function openMailComposer\(/);
  assert.match(chat, /async function submitMailCompose\(action: "draft"\|"request_approval"\)/);
  assert.match(chat, /function openInlineEmailComposer\(/);
  assert.match(chat, /function requestInlineEmailApproval\(/);
  assert.match(chat, /void submitMailCompose\("request_approval"\)/);
  assert.match(chat, /if \(!composeDraftId\)/);
  assert.match(chat, /if \(!mailComposerOpen\)/);
  assert.match(chat, /composeActionId/);
  assert.match(chat, /window\.confirm\("Request approval to send the saved draft/);
  assert.match(chat, /Save email draft/);
  assert.match(chat, /\/mail\/approvals/);
});

test("mail card shows accurate unsent, saved-draft and pending-approval states", () => {
  assert.match(controls, /draft_saved/);
  assert.match(controls, /pending_approval/);
  assert.match(controls, /No email has been sent/);
  assert.match(controls, /\/mail\/approvals/);
  assert.doesNotMatch(controls, /fetch\(|dangerouslySetInnerHTML|email\.send|window\.location/);
});

test("no inline prompt, assistant content, or selected control can directly send mail", () => {
  assert.match(chat, /onClick=\{\(\) => void submitMailCompose\("draft"\)\}/);
  assert.match(chat, /onClick=\{\(\) => void submitMailCompose\("request_approval"\)\}/);
  assert.match(chat, /if \(agentSwitchInFlightRef\.current \|\| chatTurnInFlightRef\.current/);
  assert.match(composeRoute, /"email\.draft\.create"/);
  assert.match(composeRoute, /"email\.send\.request"/);
  assert.match(composeRoute, /mayWriteComposeDraft\(trusted\.subject\.permissions\)/);
  assert.match(composeRoute, /createEmailToolRuntime\(organizationId, agentId\)/);
  assert.doesNotMatch(composeRoute, /sendDraft\(|\.send\(/);
  assert.doesNotMatch(controls, /POST|PATCH|\/api\/chat\/mail-compose/);
});

test("existing editor modifications still invalidate a prior saved draft and approval", () => {
  assert.match(chat, /function invalidateComposeReview\(\)/);
  assert.match(chat, /setComposeDraftId\(null\)/);
  assert.match(chat, /setComposeActionId\(null\)/);
  assert.match(chat, /onChange=\{e => \{ setComposeTo\(e\.target\.value\); invalidateComposeReview\(\); \}\}/);
  assert.match(chat, /onChange=\{e => \{ setComposeSubject\(e\.target\.value\); invalidateComposeReview\(\); \}\}/);
  assert.match(chat, /onChange=\{e => \{ setComposeBody\(e\.target\.value\); invalidateComposeReview\(\); \}\}/);
});
