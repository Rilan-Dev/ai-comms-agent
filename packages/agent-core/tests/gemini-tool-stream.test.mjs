import test from "node:test";
import assert from "node:assert/strict";
import { readGeminiToolCompletion } from "../src/gemini-tool-stream.ts";

const encoder = new TextEncoder();
const frame = (value) => "data: " + JSON.stringify(value) + "\n\n";
const done = frame({ candidates: [{ finishReason: "STOP" }] });
const call = (name, args) => frame({ candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }] });
function response(...chunks) {
  return new ReadableStream({ start(controller) { for (const x of chunks) controller.enqueue(encoder.encode(x)); controller.close(); } });
}
test("Gemini SSE waits for STOP before returning complete function-call args", async () => {
  const source = call("email.accounts.list", { account_id: "mine" });
  const result = await readGeminiToolCompletion(response(source.slice(0, 11), source.slice(11), done));
  assert.equal(result.finishReason, "STOP");
  assert.deepEqual(result.toolCalls.map((c) => ({ name: c.name, arguments: c.arguments })), [
    { name: "email.accounts.list", arguments: { account_id: "mine" } },
  ]);
});
test("Gemini incomplete stream returns no executable tool calls", async () => {
  const result = await readGeminiToolCompletion(response(call("email.accounts.list", {})));
  assert.equal(result.finishReason, "invalid_tool_call");
  assert.deepEqual(result.toolCalls, []);
});
test("Gemini malformed or nonobject arguments are rejected", async () => {
  for (const args of [[], null, "{}", true]) {
    const result = await readGeminiToolCompletion(response(call("email.accounts.list", args), done));
    assert.equal(result.finishReason, "invalid_tool_arguments");
    assert.deepEqual(result.toolCalls, []);
  }
});
test("Gemini repeated identical snapshots are never executed twice", async () => {
  const result = await readGeminiToolCompletion(response(call("email.accounts.list", {}), call("email.accounts.list", {}), done));
  assert.equal(result.toolCalls.length, 1);
});
test("Gemini changed duplicate call arguments fail closed", async () => {
  const result = await readGeminiToolCompletion(response(call("email.accounts.list", { account_id: "1" }),
    call("email.accounts.list", { account_id: "2" }), done));
  assert.equal(result.finishReason, "invalid_tool_arguments");
  assert.deepEqual(result.toolCalls, []);
});
test("Gemini output with a truncated finish reason is rejected", async () => {
  const result = await readGeminiToolCompletion(response(call("email.accounts.list", {}),
    frame({ candidates: [{ finishReason: "MAX_TOKENS" }] })));
  assert.equal(result.finishReason, "invalid_tool_call");
});
test("Gemini text-only SSE assembles incremental parts", async () => {
  const result = await readGeminiToolCompletion(response(
    frame({ candidates: [{ content: { parts: [{ text: "Hello " }] } }] }),
    frame({ candidates: [{ content: { parts: [{ text: "world" }] } }] }),
    done));
  assert.deepEqual(result, { text: "Hello world", toolCalls: [], finishReason: "STOP" });
});
test("Gemini malformed function names do not escape the provider boundary", async () => {
  const result = await readGeminiToolCompletion(response(call("javascript:alert", {}), done));
  assert.equal(result.finishReason, "invalid_tool_call");
  assert.deepEqual(result.toolCalls, []);
});
test("Gemini UTF-8 split across byte boundaries stays intact", async () => {
  const bytes = encoder.encode(call("email.accounts.list", { subject: "தமிழ் 🌍" }) + done);
  const stream = new ReadableStream({
    start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); },
  });
  const result = await readGeminiToolCompletion(stream);
  assert.equal(result.toolCalls[0].arguments.subject, "தமிழ் 🌍");
});


test("signed multi-tool Gemini replies preserve exact provider signatures and order", async () => {
  const sig = "opaque-real-provider-signature-ABC123";
  const source = frame({ candidates: [{ content: { parts: [
    { text: "internal thought", thought: true, thoughtSignature: "opaque-thought" },
    { functionCall: { name: "email.accounts.list", args: {} }, thoughtSignature: sig },
    { functionCall: { name: "email.messages.list", args: { unread: true } } },
  ] } }] });
  const result = await readGeminiToolCompletion(response(source, done));
  assert.equal(result.finishReason, "STOP");
  assert.equal(result.text, "");
  assert.equal(result.toolCalls[0].thoughtSignature, sig);
  assert.equal(result.toolCalls[1].thoughtSignature, undefined);
  assert.deepEqual(result.geminiParts, [
    { text: "internal thought", thought: true, thoughtSignature: "opaque-thought" },
    { functionCall: { name: "email.accounts.list", args: {} }, thoughtSignature: sig },
    { functionCall: { name: "email.messages.list", args: { unread: true } } },
  ]);
});

test("repeated Gemini function snapshots retain a later delivered signature", async () => {
  const result = await readGeminiToolCompletion(response(
    call("email.accounts.list", {}),
    frame({ candidates: [{ content: { parts: [{
      functionCall: { name: "email.accounts.list", args: {} }, thoughtSignature: "late-opaque",
    }] } }] }),
    done,
  ));
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].thoughtSignature, "late-opaque");
  assert.equal(result.geminiParts[0].thoughtSignature, "late-opaque");
});

test("conflicting or malformed Gemini signatures fail closed", async () => {
  for (const thoughtSignature of [42, "", "x".repeat(16_001)]) {
    const result = await readGeminiToolCompletion(response(
      frame({ candidates: [{ content: { parts: [{
        functionCall: { name: "email.accounts.list", args: {} }, thoughtSignature,
      }] } }] }), done,
    ));
    assert.deepEqual(result.toolCalls, []);
    assert.equal(result.finishReason, "invalid_tool_call");
  }
  const result = await readGeminiToolCompletion(response(
    frame({ candidates: [{ content: { parts: [{
      functionCall: { name: "email.accounts.list", args: {} }, thoughtSignature: "first",
    }] } }] }),
    frame({ candidates: [{ content: { parts: [{
      functionCall: { name: "email.accounts.list", args: {} }, thoughtSignature: "second",
    }] } }] }),
    done,
  ));
  assert.deepEqual(result.toolCalls, []);
  assert.equal(result.finishReason, "invalid_tool_arguments");
});
