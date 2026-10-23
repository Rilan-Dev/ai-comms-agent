import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { preserveEmailBody } from "../../../packages/email-agent-runtime/src/email-body";

test("email body preserves leading indentation, trailing newlines and user-authored spaces", () => {
  const original = "  Dear team,\n\n    - task\n\nRegards,\n   ";
  assert.equal(preserveEmailBody(original), original);
  assert.equal(preserveEmailBody("\n"), "\n");
  assert.equal(preserveEmailBody(""), "");
});

test("oversize email content is rejected rather than silently truncated", () => {
  assert.throws(() => preserveEmailBody("x".repeat(100001)), /maximum/i);
  assert.equal(preserveEmailBody("x".repeat(100000)).length, 100000);
});

test("write handlers preserve body for create, update, reply and reviewed send snapshots", () => {
  const source = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");
  assert.match(source, /bodyText: reviewedBody\(input\.body_text, context\)/);
  assert.match(source, /bodyText: preserveEmailBody\(draft\.text_body\)/);
  assert.match(source, /bodyText: preserveEmailBody\(source\.text_body\)/);
  assert.doesNotMatch(source, /text\((?:input\.body_text|draft\.text_body|source\.text_body),\s*100000\)/);
});

test("chat draft API rejects overlong values and passes the unmodified body to the audited tool", () => {
  const route = readFileSync(new URL("../../../apps/web/src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");
  assert.match(route, /const bodyText = typeof body\?\.bodyText === "string" \? body\.bodyText : ""/);
  assert.match(route, /bodyText\.length > 100000/);
  assert.match(route, /subject\.length > 998/);
  assert.match(route, /recipient\.length > 320/);
  assert.match(route, /!bodyText\.trim\(\)/);
  assert.match(route, /body_text: bodyText/);
  assert.match(route, /invokeEmailReadTool\(runtime, toolName, input, context\)/);
  assert.doesNotMatch(route, /const bodyText = bounded\(body\?\.bodyText, 100000\)/);
});


test("forward draft does not trim or silently slice quoted original content", () => {
  const source = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");
  const forward = source.slice(source.indexOf('const forwardDraft = makeTool("email.draft_forward"'), source.indexOf('const requestSend = makeTool("email.send.request"'));
  assert.match(forward, /const originalBody = preserveEmailBody\(source\.text_body\)/);
  assert.match(forward, /const forwardedBody =/);
  assert.match(forward, /if \(forwardedBody\.length > 100000\)/);
  assert.match(forward, /bodyText: forwardedBody/);
  assert.doesNotMatch(forward, /text\(source\.text_body, 90000\)/);
  assert.doesNotMatch(forward, /\.trim\(\),/);
});
