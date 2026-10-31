import test from "node:test";
import assert from "node:assert/strict";
import { createSarvamToolBridge } from "../src/sarvam-tool-bridge.ts";

test("Sarvam function names are distinct provider-safe aliases for the registered host tools", () => {
  const bridge = createSarvamToolBridge(["email.draft.create", "email.send.request", "email.accounts.list"]);
  const first = bridge.toProvider("email.draft.create");
  const second = bridge.toProvider("email.send.request");
  assert.match(first, /^[a-zA-Z0-9_-]{1,64}$/);
  assert.match(second, /^[a-zA-Z0-9_-]{1,64}$/);
  assert.notEqual(first, second);
  assert.equal(bridge.fromProvider(first), "email.draft.create");
  assert.equal(bridge.fromProvider(second), "email.send.request");
  assert.equal(bridge.fromProvider(bridge.toProvider("email.accounts.list")), "email.accounts.list");
});

test("unknown, spoofed and duplicate provider function names fail closed", () => {
  const bridge = createSarvamToolBridge(["email.draft.create", "email.send.request"]);
  assert.equal(bridge.fromProvider("email.send.request"), null);
  assert.equal(bridge.fromProvider("random_provider_function"), null);
  assert.throws(() => bridge.toProvider("email.send.unsafe"), /registered/);
  assert.throws(() => createSarvamToolBridge(["email.search", "email.search"]), /duplicate/i);
});

test("an API-visible alias has no authority without a matching registered tool", () => {
  const bridge = createSarvamToolBridge(["email.search"]);
  assert.equal(bridge.fromProvider("email_send_request_1"), null);
  assert.notEqual(bridge.toProvider("email.search"), "email.search");
});

test("Sarvam Chat V1 is wired to actual host tools without direct email sending", () => {
  const runtime = readRuntime();
  assert.match(runtime, /createSarvamToolBridge\(/);
  assert.match(runtime, /config\.provider === "sarvam"/);
  assert.match(runtime, /"api-subscription-key"/);
  assert.match(runtime, /max_tokens: options\.maxTokens/);
  assert.match(runtime, /tool_choice: "auto"/);
  assert.match(runtime, /bridge\.fromProvider\(/);
  assert.match(runtime, /choice\?\.finish_reason !== "tool_calls"/);
  assert.match(runtime, /role: "tool", tool_call_id: message\.tool_call_id, content: message\.content/);
  assert.match(runtime, /readOpenAIToolCompletion\(/);
  assert.doesNotMatch(runtime, /Native tool calling is not enabled for Sarvam/);
  const chat = readChatRoute();
  assert.match(chat, /invokeEmailReadTool\(/);
  assert.match(chat, /registeredTool\?\.sensitivity/);
  assert.match(chat, /toolOutput\?\.status === "pending_approval"/);
});

import { readFileSync } from "node:fs";
const readRuntime = () => readFileSync(new URL("../src/runtime.ts", import.meta.url), "utf8");
const readChatRoute = () => readFileSync(new URL("../../../apps/web/src/app/api/chat/stream/route.ts", import.meta.url), "utf8");
