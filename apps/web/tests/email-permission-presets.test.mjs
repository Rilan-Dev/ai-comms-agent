import test from "node:test";
import assert from "node:assert/strict";
import { EMAIL_PERMISSION_PRESETS, REGISTERED_EMAIL_POLICY_NAMES, emailPermissionPresetSelection } from "../src/lib/agents/email-permission-presets.ts";
import { readFileSync } from "node:fs";

test("preset selections cover the actual registered read, draft and send-request actions", () => {
  const read = emailPermissionPresetSelection([], "read");
  const draft = emailPermissionPresetSelection([], "draft");
  const send = emailPermissionPresetSelection([], "approval");
  assert.equal(EMAIL_PERMISSION_PRESETS.length, 4);
  assert.ok(read.includes("email.search") && read.includes("email.accounts.list"));
  assert.ok(!read.includes("email.draft.create"));
  assert.ok(draft.includes("email.draft.create") && !draft.includes("email.send.request"));
  assert.ok(send.includes("email.send.request") && send.includes("email.draft.create"));
  assert.ok(!send.includes("email.send") && !send.includes("email.send.direct"));
  assert.equal(new Set(REGISTERED_EMAIL_POLICY_NAMES).size, REGISTERED_EMAIL_POLICY_NAMES.length);
});

test("preset replacement preserves custom permissions, never adds send privilege implicitly", () => {
  const existing = ["custom.something", "email.search", "email.send.request", "whatsapp.send"];
  assert.deepEqual(emailPermissionPresetSelection(existing, "off"), ["custom.something", "whatsapp.send"]);
  const read = emailPermissionPresetSelection(existing, "read");
  assert.ok(read.includes("whatsapp.send"));
  assert.ok(!read.includes("email.send.request"));
  assert.deepEqual(emailPermissionPresetSelection(read, "read"), read);
});

test("agent page and chat only save choices after explicit user confirmation", () => {
  const agent = readFileSync(new URL("../src/app/agents/[id]/agent-detail-client.tsx", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  assert.match(agent, /emailPermissionPresetSelection\(/);
  assert.match(agent, /window\.confirm\(/);
  assert.match(chat, /Mail permissions/);
  assert.match(chat, /emailPermissionPresetSelection\(/);
  assert.match(chat, /window\.confirm\(/);
  const route = readFileSync(new URL("../src/app/api/agents/[id]/policy/route.ts", import.meta.url), "utf8");
  assert.match(route, /role: "admin"/);
});
