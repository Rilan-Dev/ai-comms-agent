import test from "node:test";
import assert from "node:assert/strict";
import { toGeminiToolContents } from "../src/gemini-tool-history.ts";

const tools = [
  { name: "email.accounts.list", description: "Read account names", parameters: { type: "object", properties: {} } },
  { name: "email.messages.list", description: "List messages", parameters: { type: "object", properties: {} } },
];

test("scheduling history sends back exact signed function-call parts and untrusted results", () => {
  const parts = [
    { text: "internal thought", thought: true, thoughtSignature: "signed-thought" },
    { functionCall: { name: "email.accounts.list", args: {} }, thoughtSignature: "signed-call" },
    { functionCall: { name: "email.messages.list", args: { unread: true } } },
  ];
  const calls = [
    { id: "call1", name: "email.accounts.list", arguments: {}, thoughtSignature: "signed-call" },
    { id: "call2", name: "email.messages.list", arguments: { unread: true } },
  ];
  const history = toGeminiToolContents([
    { role: "system", content: "Do not send WhatsApp" },
    { role: "user", content: "List unread mail" },
    { role: "assistant", content: null, tool_calls: calls, geminiParts: parts },
    { role: "tool", content: '{"ok":true}', name: "email.accounts.list", tool_call_id: "call1" },
    { role: "tool", content: '{"ok":true}', name: "email.messages.list", tool_call_id: "call2" },
  ]);
  assert.equal(history.length, 3);
  assert.deepEqual(history[1].parts, parts);
  assert.equal(history[2].parts[0].functionResponse.name, "email.accounts.list");
  assert.equal(history[2].parts[1].functionResponse.name, "email.messages.list");
});

test("Gemini history rejects mismatched signed parts rather than forging a provider turn", () => {
  assert.throws(() => toGeminiToolContents([
    { role: "assistant", content: null, tool_calls: [{ id: "1", name: "whatsapp.send", arguments: {} }],
      geminiParts: [{ functionCall: { name: "email.accounts.list", args: {} }, thoughtSignature: "opaque" }] },
  ]), /do not match/);
});
