import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeEmailRecipients } from "../../../packages/email-agent-runtime/src/email-recipients";

const source = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");
function handler(start: string, end: string): string {
  const a = source.indexOf(`const ${start} = makeTool(`);
  const b = source.indexOf(`const ${end} = makeTool(`, a);
  assert.ok(a >= 0 && b > a, `Expected handler for ${start}`);
  return source.slice(a, b);
}

test("required recipients reject missing, malformed and header-injection addresses", () => {
  for (const bad of [
    null, undefined, "", [], [" "], ["display name"], ["name@example.test\r\nBcc: attacker@example.test"],
    ["user@example.test", "invalid"], ["x".repeat(321) + "@example.test"],
    ["a@@example.test"], ["a@example"], ["a,b@example.test"], ["a;b@example.test"],
    ["Alice <alice@example.test>"], ['"alice"@example.test'], ["a\\\\name@example.test"],
    [42], ["valid@example.test", null],
    Array.from({ length: 101 }, () => "valid@example.test"),
  ]) assert.equal(normalizeEmailRecipients(bad, true), null, JSON.stringify(bad)?.slice(0, 80));
});

test("optional CC and BCC require valid arrays and never silently drop malformed entries", () => {
  assert.deepEqual(normalizeEmailRecipients([], false), []);
  assert.equal(normalizeEmailRecipients(null, false), null);
  assert.equal(normalizeEmailRecipients("a@example.test", false), null);
  assert.equal(normalizeEmailRecipients(["valid@example.test", ""], false), null);
  assert.equal(normalizeEmailRecipients(["valid@example.test", "not-an-email"], false), null);
});

test("valid address lists are trimmed with order and multiplicity preserved", () => {
  assert.deepEqual(normalizeEmailRecipients(["  one@example.test  ", "two+tag@example.test"], true),
    ["one@example.test", "two+tag@example.test"]);
  assert.deepEqual(normalizeEmailRecipients(["same@example.test", "same@example.test"], true),
    ["same@example.test", "same@example.test"]);
  assert.deepEqual(normalizeEmailRecipients([], true), null);
});

test("all draft and approval entry points validate recipient addresses before persistence", () => {
  const create = handler("draftCreate", "draftUpdate");
  assert.match(create, /requireRecipients\(input\.to\)/);
  assert.match(create, /optionalRecipients\(input\.cc\)/);
  assert.match(create, /optionalRecipients\(input\.bcc\)/);

  const update = handler("draftUpdate", "replyDraft");
  assert.match(update, /requireRecipients\(input\.to\)/);
  assert.match(update, /optionalRecipients\(input\.cc\)/);
  assert.match(update, /optionalRecipients\(input\.bcc\)/);

  const reply = handler("replyDraft", "forwardDraft");
  assert.match(reply, /requireRecipients\(\[sender\]\)/);

  const forward = handler("forwardDraft", "requestSend");
  assert.match(forward, /requireRecipients\(input\.to\)/);

  const request = handler("requestSend", "requestReply");
  assert.match(request, /requireRecipients\(draft\.to_recipients\)/);
  assert.match(request, /optionalRecipients\(draft\.cc_recipients\)/);
  assert.match(request, /optionalRecipients\(draft\.bcc_recipients\)/);

  const requestReply = handler("requestReply", "requestForward");
  assert.match(requestReply, /requireRecipients\(\[recipient\]\)/);

  const requestForward = source.slice(source.indexOf('const requestForward = makeTool('));
  assert.match(requestForward, /requireRecipients\(input\.to\)/);
  assert.doesNotMatch(requestForward, /(?:sendDraft|sendMessage|provider\.send)\(/);
});

test("validation failures retain explicit recipient_required error classification", () => {
  assert.match(source, /const recipients = normalizeEmailRecipients\(value, true\)/);
  assert.match(source, /if \(!recipients\) throw new EmailWriteFailure\("recipient_required"/);
  assert.match(source, /const recipients = normalizeEmailRecipients\(value, false\)/);
});
