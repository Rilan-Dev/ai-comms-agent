import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eligibleReplyForwardSourceId } from "../../../packages/email-agent-runtime/src/email-source-identity.ts";

const write = () => readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");
const worker = () => readFileSync(new URL("../src/email/action-worker.ts", import.meta.url), "utf8");
const executor = () => readFileSync(new URL("../src/email/action-executor.ts", import.meta.url), "utf8");
const manual = () => readFileSync(new URL("../../../apps/web/src/app/api/mail/actions/route.ts", import.meta.url), "utf8");
const message = (overrides = {}) => ({
  id: "84a6cb6a-4426-4f1e-852d-521d685fd019",
  email_account_id: "mailbox-one",
  is_draft: false,
  provider_message_id: "provider-opaque-message-123",
  ...overrides,
});

test("verified provider-backed message returns LOCAL UUID for approval, never provider identifier", () => {
  assert.equal(eligibleReplyForwardSourceId(message(), "mailbox-one"),
    "84a6cb6a-4426-4f1e-852d-521d685fd019");
});

test("drafts, unsynchronized sources, bad IDs and cross-mailbox rows fail closed before approval", () => {
  for (const source of [
    null, message({is_draft: true}), message({is_draft: null}),
    message({provider_message_id: ""}), message({provider_message_id: null}),
    message({provider_message_id: "local-draft:fake"}),
    message({email_account_id: "mailbox-other"}),
    message({id: "provider-opaque-message-123"}),
    message({id: null}),
  ]) assert.equal(eligibleReplyForwardSourceId(source, "mailbox-one"), null);
});

test("AI reply and forward tool snapshots retain canonical local message identity", () => {
  const source=write();
  assert.match(source, /eligibleReplyForwardSourceId\(message, accountId\)/);
  const reply=source.slice(source.indexOf('const requestReply = makeTool('), source.indexOf('const requestForward = makeTool('));
  const forward=source.slice(source.indexOf('const requestForward = makeTool('), source.indexOf('return \[draftCreate'));
  for (const section of [reply, forward]) {
    assert.match(section, /const source = await checkMessage\(account\.id, messageId, context\)/);
    assert.match(section, /recipientSnapshot: \{ messageId,/);
    assert.doesNotMatch(section, /messageId: text\(source\.provider_message_id/);
    assert.match(section, /createEmailAction\(/);
  }
});

test("manual approvals and BOTH execution paths resolve local rows before provider calls", () => {
  const m=manual(), w=worker(), e=executor();
  assert.match(m, /snapshot = \{\s*messageId,/);
  assert.match(m, /eligibleReplyForwardSourceId\(message, emailAccountId\)/);
  for (const source of [w, e]) {
    assert.match(source, /getMailMessageForOrganization\([^\n]+, messageId\)/);
    assert.match(source, /const providerMessageId = String\(source\.provider_message_id\)/);
    assert.match(source, /Boolean\(source\.is_draft\)/);
    assert.match(source, /provider_message_id\.startsWith\("local-draft:"\)/);
  }
});
