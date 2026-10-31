import test from "node:test";
import assert from "node:assert/strict";
import { readOpenAIToolCompletion } from "../src/tool-call-stream.ts";

const encoder = new TextEncoder();
const chunk = (value) => "data: " + JSON.stringify(value) + "\n\n";
function stream(...parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}
function toolPart(args) {
  return { choices: [{ delta: { tool_calls: [args] }, finish_reason: null }] };
}
const completed = chunk({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }) + "data: [DONE]\n\n";
const call = [
  chunk(toolPart({ index: 0, id: "call-a", type: "function", function: { name: "email.", arguments: "{\"account" } })),
  chunk(toolPart({ index: 0, function: { name: "accounts.list", arguments: "_id\":\"bound\"}" } })),
];

test("fragments of names and JSON arguments are collected before tool execution", async () => {
  const output = await readOpenAIToolCompletion(stream(
    call[0].slice(0, 13), call[0].slice(13), call[1], completed,
  ));
  assert.equal(output.finishReason, "tool_calls");
  assert.deepEqual(output.toolCalls, [{ id: "call-a", name: "email.accounts.list", arguments: { account_id: "bound" } }]);
});

test("text-only stopped generation remains a non-tool response", async () => {
  const out = await readOpenAIToolCompletion(stream(
    chunk({ choices: [{ delta: { content: "No tools " }, finish_reason: null }] }),
    chunk({ choices: [{ delta: { content: "required." }, finish_reason: "stop" }] }),
    "data: [DONE]\n\n",
  ));
  assert.deepEqual(out, { text: "No tools required.", toolCalls: [], finishReason: "stop" });
});

test("premature EOF without provider DONE marker cannot execute a partial tool", async () => {
  const out = await readOpenAIToolCompletion(stream(call[0], call[1], chunk({ choices: [{ finish_reason: "tool_calls" }] })));
  assert.equal(out.finishReason, "invalid_tool_call");
  assert.deepEqual(out.toolCalls, []);
});

test("malformed JSON tool arguments fail closed with zero executable calls", async () => {
  const out = await readOpenAIToolCompletion(stream(
    chunk(toolPart({ index: 0, id: "call-b", function: { name: "email.accounts.list", arguments: "{broken" } })),
    completed,
  ));
  assert.equal(out.finishReason, "invalid_tool_arguments");
  assert.deepEqual(out.toolCalls, []);
});

test("nonobject JSON arguments never become executable", async () => {
  for (const value of ["[]", "null", "\"not-an-object\""]) {
    const out = await readOpenAIToolCompletion(stream(chunk(toolPart({
      index: 0, id: "call-b", function: { name: "email.accounts.list", arguments: value },
    })), completed));
    assert.equal(out.finishReason, "invalid_tool_arguments");
    assert.deepEqual(out.toolCalls, []);
  }
});

test("unknown tool names are parsed as data, not executed by the decoder", async () => {
  const out = await readOpenAIToolCompletion(stream(chunk(toolPart({
    index: 0, id: "call-a", function: { name: "wrong.tool", arguments: "{}" },
  })), completed));
  assert.equal(out.toolCalls[0].name, "wrong.tool");
  // Host registry policy is the *only* subsequent execution boundary.
});

test("tool-call index gaps or duplicate IDs fail closed", async () => {
  const gap = await readOpenAIToolCompletion(stream(chunk(toolPart({
    index: 1, id: "call-a", function: { name: "email.accounts.list", arguments: "{}" },
  })), completed));
  assert.equal(gap.finishReason, "invalid_tool_call");
  const duplicate = await readOpenAIToolCompletion(stream(
    chunk(toolPart({ index: 0, id: "same", function: { name: "email.accounts.list", arguments: "{}" } })),
    chunk(toolPart({ index: 1, id: "same", function: { name: "email.accounts.list", arguments: "{}" } })),
    completed,
  ));
  assert.equal(duplicate.finishReason, "invalid_tool_call");
});

test("an exhausted function-call retains its diagnosis without permission to invoke tools", async () => {
  const out = await readOpenAIToolCompletion(stream(
    chunk(toolPart({ index: 0, id: "call-a", function: { name: "email.accounts.list", arguments: "{}" } })),
    chunk({ choices: [{ delta: {}, finish_reason: "length" }] }),
    "data: [DONE]\n\n",
  ));
  assert.equal(out.finishReason, "length");
  assert.deepEqual(out.toolCalls, []);
  assert.equal(out.text, "");
});

test("oversized tool argument fragments fail closed before reaching host execution", async () => {
  const out = await readOpenAIToolCompletion(stream(
    chunk(toolPart({ index: 0, id: "call-a", function: { name: "email.accounts.list", arguments: "x".repeat(17000) } })),
    completed,
  ));
  assert.equal(out.finishReason, "invalid_tool_arguments");
});

test("split UTF-8 is losslessly parsed in tool argument JSON", async () => {
  const content = chunk(toolPart({
    index: 0, id: "call-u", function: { name: "email.accounts.list", arguments: JSON.stringify({ subject: "தமிழ் 🌍" }) },
  }));
  const bytes = encoder.encode(content + completed);
  const output = await readOpenAIToolCompletion(new ReadableStream({
    start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); },
  }));
  assert.equal(output.toolCalls[0].arguments.subject, "தமிழ் 🌍");
});
