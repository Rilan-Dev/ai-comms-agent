import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../../apps/web/src/app/api/mail/actions/route.ts", import.meta.url), "utf8");
const oneShot = readFileSync(new URL("../src/email/action-executor.ts", import.meta.url), "utf8");
const batch = readFileSync(new URL("../src/email/action-worker.ts", import.meta.url), "utf8");

test("reply/forward requests reject malformed source sender and every invalid recipient before approval", () => {
  const post = route.slice(route.indexOf("export async function POST("), route.indexOf("export async function PATCH("));
  assert.match(post, /const rawRecipients = actionType === "reply_email"/);
  assert.match(post, /const to = validRecipients\(rawRecipients\)/);
  assert.match(post, /to.length === 0 \|\| to.length !== rawRecipients.length/);
  assert.match(post, /cc.length !== rawCc.length/);
  assert.match(post, /bcc.length !== rawBcc.length/);
  assert.match(post, /error: "invalid_action_recipients"/);
  assert.match(post, /status: 422/);
  assert.ok(post.indexOf("invalid_action_recipients") < post.indexOf("createEmailAction({"));
});

test("batch reply and forward never pass local UUID to remote provider and require same mailbox", () => {
  const area = batch.slice(batch.indexOf('if (action.actionType === "reply_email")'), batch.indexOf("providerResult = result.value"));
  assert.match(batch, /getMailMessageForOrganization/);
  assert.match(area, /getMailMessageForOrganization\(action.organizationId, messageId\)/);
  assert.match(area, /String\(source.email_account_id\) !== action.emailAccountId/);
  assert.match(area, /source.provider_message_id/);
  assert.match(area, /paramsFromApprovedEmailSnapshot\(snapshot\)/);
  assert.match(area, /connected.reply\(providerMessageId, params\)/);
  assert.match(area, /connected.forward\(providerMessageId, params.to\)/);
  assert.doesNotMatch(area, /connected\.reply\(messageId,/);
  assert.doesNotMatch(area, /connected\.forward\(messageId,/);
});

test("one-shot reply/forward applies identical source mailbox and immutable recipient controls", () => {
  const area = oneShot.slice(oneShot.indexOf('const messageId = String(snapshot.messageId ?? "")'), oneShot.indexOf("const completed = await completeEmailAction"));
  assert.match(area, /getMailMessageForOrganization\(organizationId, messageId\)/);
  assert.match(area, /String\(source.email_account_id\) !== claimed.emailAccountId/);
  assert.match(area, /const providerMessageId = String\(source.provider_message_id\)/);
  assert.match(area, /paramsFromApprovedEmailSnapshot\(snapshot\)/);
  assert.match(area, /connected.reply\(providerMessageId, params\)/);
  assert.match(area, /connected.forward\(providerMessageId, params.to\)/);
  assert.doesNotMatch(area, /snapshot\.to\.map\(String\)/);
});
