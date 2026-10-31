import test from "node:test";
import assert from "node:assert/strict";
import { createProvider } from "@ai-comms-agent/agent-core";

test("Gemini mocked two-round tool adapter preserves provider signatures and batches responses", async () => {
  const previousFetch = globalThis.fetch;
  const captured: Array<{ contents: Array<{ role: string; parts: Array<{
    thoughtSignature?: string;
    functionCall?: { name: string };
    functionResponse?: { name: string };
  }> }> }> = [];
  let round = 0;
  globalThis.fetch = async (_url, init) => {
    captured.push(JSON.parse(String(init?.body ?? "")) as typeof captured[number]);
    const frames = round++ === 0
      ? [{ candidates: [{ content: { parts: [
        { functionCall: { name: "email.accounts.list", args: {} }, thoughtSignature: "opaque-provider-signature" },
        { functionCall: { name: "email.messages.list", args: { unread: true } } },
      ] } }] }, { candidates: [{ finishReason: "STOP" }] }]
      : [{ candidates: [{ content: { parts: [{ text: "Read-only check complete." }] } }] },
        { candidates: [{ finishReason: "STOP" }] }];
    return new Response(frames.map(frame =>
      "data: " + JSON.stringify(frame) + String.fromCharCode(10, 10)).join(""),
      { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  try {
    const provider = createProvider({
      provider: "gemini", apiKey: "test-placeholder", chatModel: "gemini-test",
      baseUrl: "https://example.invalid",
    });
    const definitions = [
      { name: "email.accounts.list", description: "Read-only account discovery", parameters: { type: "object" } },
      { name: "email.messages.list", description: "Read-only message list", parameters: { type: "object" } },
    ];
    const first = await provider.chatWithTools([{ role: "user", content: "List unread mail" }], definitions);
    assert.equal(first.toolCalls.length, 2);
    const second = await provider.chatWithTools([
      { role: "user", content: "List unread mail" },
      { role: "assistant", content: first.text || null, tool_calls: first.toolCalls, geminiParts: first.geminiParts },
      { role: "tool", content: '{"ok":true}', tool_call_id: first.toolCalls[0]!.id, name: first.toolCalls[0]!.name },
      { role: "tool", content: '{"ok":true}', tool_call_id: first.toolCalls[1]!.id, name: first.toolCalls[1]!.name },
    ], definitions);
    assert.equal(second.text, "Read-only check complete.");
    const model = captured[1]!.contents.find(entry => entry.role === "model");
    assert.equal(model?.parts[0]?.thoughtSignature, "opaque-provider-signature");
    assert.equal(model?.parts[1]?.functionCall?.name, "email.messages.list");
    const responses = captured[1]!.contents.filter(entry => entry.parts[0]?.functionResponse);
    assert.equal(responses.length, 1);
    assert.deepEqual(responses[0]!.parts.map(part => part.functionResponse?.name),
      ["email.accounts.list", "email.messages.list"]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Gemini retry recovers provider demand without duplicating host tool execution", async () => {
  const previousFetch = globalThis.fetch;
  const captured: string[] = [];
  let calls=0;
  let hostReads=0;
  globalThis.fetch = async (_url,init) => {
    captured.push(String(init?.body));
    const attempt=++calls;
    if ([1,2,4].includes(attempt)) return new Response("high demand", {status:503});
    const parts = attempt===3
      ? [{functionCall:{name:"email.accounts.list",args:{}},thoughtSignature:"opaque-signed-on-success"}]
      : [{text:"One authorized mailbox checked."}];
    const sse = [
      {candidates:[{content:{parts}}]},
      {candidates:[{finishReason:"STOP"}]},
    ].map(f=>"data: "+JSON.stringify(f)+"\n\n").join("");
    return new Response(sse,{status:200,headers:{"content-type":"text/event-stream"}});
  };
  try {
    const provider=createProvider({provider:"gemini",apiKey:"placeholder",chatModel:"gemini-test",baseUrl:"https://example.invalid"});
    const definitions=[{name:"email.accounts.list",description:"Read-only",parameters:{type:"object"}}];
    const user={role:"user" as const,content:"List accounts, do not send messages"};
    const first=await provider.chatWithTools([user],definitions);
    assert.equal(first.toolCalls.length,1);
    assert.equal(first.toolCalls[0]?.thoughtSignature,"opaque-signed-on-success");
    assert.equal(hostReads,0);
    const tool=first.toolCalls[0]!;
    const authorizedResult=JSON.stringify({ok:true,accountCount:++hostReads});
    const second=await provider.chatWithTools([
      user,
      {role:"assistant",content:first.text||null,tool_calls:first.toolCalls,geminiParts:first.geminiParts},
      {role:"tool",tool_call_id:tool.id,name:tool.name,content:authorizedResult},
    ],definitions);
    assert.equal(second.text,"One authorized mailbox checked.");
    assert.equal(second.toolCalls.length,0);
    assert.equal(hostReads,1,"transient provider retries do not repeat host tools");
    assert.equal(calls,5);
    assert.equal(captured[0],captured[1]);
    assert.equal(captured[1],captured[2]);
    assert.equal(captured[3],captured[4]);
    assert.ok(captured[3]?.includes("opaque-signed-on-success"));
  } finally {globalThis.fetch=previousFetch;}
});
