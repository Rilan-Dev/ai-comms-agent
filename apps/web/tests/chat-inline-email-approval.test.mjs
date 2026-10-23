import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateChatEmailApproval } from "../src/lib/chat/inline-mail-approval.ts";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const chat = read("../src/app/chat/chat-client.tsx");
const review = read("../src/app/chat/chat-inline-mail-approval.tsx");
const actions = read("../src/app/api/mail/actions/route.ts");

const original = {
  id: "approval-one", actionType: "send_email", status: "pending_approval",
  draftId: "draft-one", emailAccountId: "mailbox-one", expiresAt: "2999-01-01T00:00:00.000Z",
  recipientSnapshot: { to: ["reader@example.org"], cc: [], bcc: [], subject: "Review this", bodyText: "Hello" },
};
const expected = { actionId: "approval-one", draftId: "draft-one", accountId: "mailbox-one" };

test("accepts only a matching, non-expired saved send request with a complete server snapshot", () => {
  assert.deepEqual(validateChatEmailApproval(original, expected)?.recipientSnapshot.to, ["reader@example.org"]);
  for (const override of [
    {id: "wrong"}, {actionType: "forward_email"}, {status: "approved"}, {draftId: "other"},
    {emailAccountId: "other"}, {expiresAt: "2000-01-01T00:00:00.000Z"},
    {recipientSnapshot: {to: [], subject: "Subject", bodyText: "Hello"}},
    {recipientSnapshot: {to: ["reader@example.org"], subject: "<h1>", bodyText: null}},
  ]) assert.equal(validateChatEmailApproval({...original, ...override}, expected), null);
});

test("Chat exposes authoritative review card only after a saved send approval is requested", () => {
  assert.match(chat, /import \{ InlineMailApprovalReview \} from "\.\/chat-inline-mail-approval"/);
  assert.match(chat, /composeActionId && composeDraftId && composeAccount/);
  assert.match(chat, /<InlineMailApprovalReview/);
  assert.match(chat, /organizationId=\{organizationId\}/);
  assert.match(chat, /actionId=\{composeActionId\}/);
  assert.match(chat, /draftId=\{composeDraftId\}/);
  assert.match(chat, /accountId=\{composeAccount\}/);
});

test("inline approval requires explicit server fetch, review checkbox and confirmation", () => {
  assert.match(review, /fetch\("\/api\/mail\/actions\?"/);
  assert.match(review, /validateChatEmailApproval/);
  assert.match(review, /Reviewed recipient, subject and body/);
  assert.match(review, /checked=\{reviewConfirmed\}/);
  assert.match(review, /!reviewConfirmed/);
  assert.match(review, /window\.confirm\(/);
  assert.match(review, /fetch\("\/api\/mail\/actions"/);
  assert.match(review, /method: "PATCH"/);
  assert.match(review, /decision: "approved"/);
  assert.match(review, /queue/);
  assert.match(review, /setDecisionDone\(true\)/);
  assert.doesNotMatch(review, /dangerouslySetInnerHTML|setInterval|email\.send\.request/);
});

test("backend still verifies the organization.update reviewer permission and pending approval", () => {
  assert.match(actions, /permission: "organization.update"/);
  assert.match(actions, /decideEmailAction\(organizationId, actionId, subject\.user\.id, decision/);
  assert.match(actions, /assertSameOrigin\(request\)/);
  assert.doesNotMatch(review, /sendDraft\(|provider\.send\(/);
});
