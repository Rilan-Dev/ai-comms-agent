import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createProvider } from "@ai-comms-agent/agent-core";
import type { ChatToolDefinition, ToolChatMessage } from "@ai-comms-agent/agent-core";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const tools: ChatToolDefinition[] = [{
  name: "email.accounts.list",
  description: "List accessible mailboxes.",
  parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
}];

test("OpenAI tool adapter serializes assistant calls and parses function arguments", async () => {
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      choices: [{
        finish_reason: "tool_calls",
        message: { content: "", tool_calls: [{ id: "call-1", type: "function", function: { name: "email.accounts.list", arguments: "{}" } }] },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  const provider = createProvider({ provider: "openai", apiKey: "test-key", baseUrl: "https://provider.test", chatModel: "test-model" });
  const history: ToolChatMessage[] = [
    { role: "user", content: "List my mailboxes" },
    { role: "assistant", content: "", tool_calls: [{ id: "prior-call", name: "email.accounts.list", arguments: {} }] },
    { role: "tool", tool_call_id: "prior-call", name: "email.accounts.list", content: "UNTRUSTED TOOL RESULT" },
  ];
  const completion = await provider.chatWithTools?.(history, tools);
  assert.equal(completion?.toolCalls[0]?.name, "email.accounts.list");
  assert.deepEqual(completion?.toolCalls[0]?.arguments, {});
  const sentMessages = requestBody?.messages as Array<Record<string, unknown>>;
  const assistant = sentMessages.find((message) => message.role === "assistant" && Array.isArray(message.tool_calls));
  const wireCalls = assistant?.tool_calls as Array<{ function: { arguments: string } }>;
  assert.equal(wireCalls[0]?.function.arguments, "{}");
  assert.equal(sentMessages.some((message) => message.role === "tool" && message.tool_call_id === "prior-call"), true);
});

test("OpenAI tool adapter fails closed on malformed function arguments", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    choices: [{ finish_reason: "tool_calls", message: { content: "I'll do that", tool_calls: [{ id: "call-bad", function: { name: "email.accounts.list", arguments: "{bad json" } }] } }],
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

  const provider = createProvider({ provider: "openai", apiKey: "test-key", baseUrl: "https://provider.test", chatModel: "test-model" });
  const completion = await provider.chatWithTools?.([{ role: "user", content: "List my mailboxes" }], tools);
  assert.equal(completion?.finishReason, "invalid_tool_arguments");
  assert.deepEqual(completion?.toolCalls, []);
  assert.match(completion?.text ?? "", /did not execute/i);
});

test("Gemini tool adapter maps function-call parts and rejects HTTP failures", async () => {
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
    candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "email.accounts.list", args: {} } }] } }],
  }), { status: 200, headers: { "content-type": "application/json" } }) as typeof fetch;
  });

  const provider = createProvider({ provider: "gemini", apiKey: "test-key", baseUrl: "https://provider.test", chatModel: "test-model" });
  const completion = await provider.chatWithTools?.([
    { role: "user", content: "List my mailboxes" },
    { role: "assistant", content: "", tool_calls: [{ id: "prior-call", name: "email.accounts.list", arguments: {} }] },
    { role: "tool", tool_call_id: "prior-call", name: "email.accounts.list", content: "UNTRUSTED TOOL RESULT" },
  ], tools);
  assert.equal(completion?.toolCalls[0]?.name, "email.accounts.list");
  const contents = requestBody?.contents as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  assert.equal(contents.some((entry) => entry.role === "model" && entry.parts.some((part) => "functionCall" in part)), true);
  assert.equal(contents.some((entry) => entry.role === "user" && entry.parts.some((part) => "functionResponse" in part)), true);

  globalThis.fetch = (async () => new Response("provider down", { status: 503 })) as typeof fetch;
  await assert.rejects(() => provider.chatWithTools?.([{ role: "user", content: "List my mailboxes" }], tools), /Gemini tool request failed \(503\)/);
});


test("Sarvam maps registered host tools through its verified request-local bridge", async () => {
  let requestedName='';
  globalThis.fetch=(async(_input: RequestInfo | URL,init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body));requestedName=body.tools[0].function.name;
    return Response.json({choices:[{finish_reason:'tool_calls',message:{content:'',tool_calls:[{id:'sarvam-qa',function:{name:requestedName,arguments:'{}'}}]}}]});
  }) as typeof fetch;
  const provider=createProvider({provider:'sarvam',apiKey:'test-key',baseUrl:'https://provider.test',chatModel:'test-model'});
  const completion=await provider.chatWithTools?.([{role:'user',content:'List mailboxes'}],tools);
  assert.match(requestedName,/^[A-Za-z0-9_-]+$/);
  assert.deepEqual(completion?.toolCalls,[{id:'sarvam-qa',name:'email.accounts.list',arguments:{}}]);
});

test("OpenAI host tool adapter buffers SSE deltas before returning complete validated calls", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const chunk = (value: unknown) => "data: " + JSON.stringify(value) + "\\n\\n";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const sse = [
      chunk({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call-2", type: "function", function: { name: "email.", arguments: "{\"acc" } }] } }] }),
      chunk({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "accounts.list", arguments: "ount_id\":\"a1\"}" } }] } }] }),
      chunk({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }),
      "data: [DONE]\\n\\n",
    ].join("").replaceAll("\\n", "\n");
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
  const provider = createProvider({ provider: "openai", apiKey: "test-key", baseUrl: "https://provider.test", chatModel: "test-model" });
  const result = await provider.chatWithTools?.([{ role: "user", content: "List mailboxes" }], tools);
  assert.equal(requestBody?.stream, true);
  assert.equal(result?.finishReason, "tool_calls");
  assert.deepEqual(result?.toolCalls, [{ id: "call-2", name: "email.accounts.list", arguments: { account_id: "a1" } }]);
});

test("OpenAI streaming adapter refuses partial or malformed function arguments", async () => {
  globalThis.fetch = (async () => new Response(
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"bad","function":{"name":"email.accounts.list","arguments":"{not-json"}}]}}]}\\n\\n'
      .replaceAll("\\n", "\n")
      + 'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\\n\\n'.replaceAll("\\n", "\n")
      + "data: [DONE]\n\n",
    { status: 200, headers: { "content-type": "text/event-stream" } },
  )) as typeof fetch;
  const provider = createProvider({ provider: "openai", apiKey: "test-key", baseUrl: "https://provider.test", chatModel: "test-model" });
  const result = await provider.chatWithTools?.([{ role: "user", content: "List mailboxes" }], tools);
  assert.equal(result?.finishReason, "invalid_tool_arguments");
  assert.deepEqual(result?.toolCalls, []);
});

test("Gemini tool adapter buffers streamed function calls until final STOP", async () => {
  let requested = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested = String(input);
    const frame = (value: unknown) => "data: " + JSON.stringify(value) + "\n\n";
    const sse = [
      frame({ candidates: [{ content: { parts: [{ functionCall: { name: "email.accounts.list", args: { account_id: "a1" } } }] } }] }),
      frame({ candidates: [{ finishReason: "STOP" }] }),
    ].join("");
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
  const provider = createProvider({ provider: "gemini", apiKey: "test-key", baseUrl: "https://provider.test", chatModel: "test-model" });
  const result = await provider.chatWithTools?.([{ role: "user", content: "List mailboxes" }], tools);
  assert.match(requested, /:streamGenerateContent\?alt=sse/);
  assert.equal(result?.finishReason, "STOP");
  assert.deepEqual(result?.toolCalls.map(({ name, arguments: args }) => ({ name, arguments: args })),
    [{ name: "email.accounts.list", arguments: { account_id: "a1" } }]);
});

test("Gemini malformed streamed arguments fail closed before host execution", async () => {
  globalThis.fetch = (async () => new Response([
    "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name: "email.accounts.list", args: [] } }] } }] }),
    "data: " + JSON.stringify({ candidates: [{ finishReason: "STOP" }] }),
  ].join("\n\n") + "\n\n", { status: 200, headers: { "content-type": "text/event-stream" } })) as typeof fetch;
  const provider = createProvider({ provider: "gemini", apiKey: "test-key", baseUrl: "https://provider.test", chatModel: "test-model" });
  const result = await provider.chatWithTools?.([{ role: "user", content: "List mailboxes" }], tools);
  assert.equal(result?.finishReason, "invalid_tool_arguments");
  assert.deepEqual(result?.toolCalls, []);
});
