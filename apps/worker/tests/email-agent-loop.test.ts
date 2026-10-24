import test from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "@ai-comms-agent/shared";
import type { Tool, ToolContext, ToolResult } from "@ai-comms-agent/shared";
import type { ChatToolCompletion, ChatToolDefinition, ToolChatMessage } from "@ai-comms-agent/clara-core";
import { runEmailAgentTurn } from "../src/agent/email-agent-loop";
import type { EmailToolRuntime } from "../src/agent/email-tool-runtime";

const context: ToolContext = {
  agent_id: "agent-1",
  organization_id: "org-1",
  user_id: "user-1",
  conversation_id: "conversation-1",
  turn_id: "turn-1",
  correlation_id: "corr-1",
  channel: "chat",
  auth_subject: { user_id: "user-1", role: "member", permissions: ["email.read"] },
};
const inputMessages = [{ role: "user" as const, content: "Find my latest email" }];

function fakeRuntime(allowed = ["email.accounts.list"]): EmailToolRuntime {
  const registry = new ToolRegistry((agentId) => agentId === "agent-1" ? allowed : null);
  const tool: Tool = {
    name: "email.accounts.list",
    domain: "email",
    description: "List available email accounts.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    sensitivity: "safe",
    required_permission: "email.read",
    execute: async () => ({ ok: true, output: [{ id: "mailbox-1" }], audit: { tool_name: "email.accounts.list", input_summary: "email.accounts.list", output_summary: "1 result", duration_ms: 1 } }),
  };
  registry.register(tool);
  if (allowed.includes("email.messages.list")) {
    registry.register({
      name: "email.messages.list",
      domain: "email",
      description: "List a bounded page of messages.",
      input_schema: { type: "object", properties: { account_id: { type: "string" }, unread_only: { type: "boolean" } }, required: ["account_id"], additionalProperties: false },
      sensitivity: "safe",
      required_permission: "email.read",
      execute: async () => okResult(),
    });
  }
  return { registry, authorize: async () => ({ allowed: true }), writeAudit: async () => {} };
}

function okResult(): ToolResult {
  return { ok: true, output: [{ id: "mailbox-1" }], audit: { tool_name: "email.accounts.list", input_summary: "email.accounts.list", output_summary: "1 result", duration_ms: 2 } };
}

test("email agent loop executes only registered, allowlisted tools and returns final model text", async () => {
  const runtime = fakeRuntime();
  let completionCount = 0;
  const invoked: string[] = [];
  const completeWithTools = async (_ctx: { orgId: string | null; agentId: string | null; kbId: string }, history: ToolChatMessage[], tools: ChatToolDefinition[]): Promise<ChatToolCompletion> => {
    completionCount += 1;
    assert.equal(tools.length, 1);
    if (completionCount === 1) {
      return { text: "", toolCalls: [{ id: "call-1", name: "email.accounts.list", arguments: {} }], finishReason: "tool_calls" };
    }
    assert.ok(history.some((message) => message.role === "tool" && message.tool_call_id === "call-1"));
    return { text: "You have one connected mailbox.", toolCalls: [], finishReason: "stop" };
  };
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages, toolContext: context,
  }, {
    createRuntime: async () => runtime,
    completeWithTools,
    invoke: async (_runtime, name) => { invoked.push(name); return okResult(); },
  });
  assert.equal(result.text, "You have one connected mailbox.");
  assert.deepEqual(invoked, ["email.accounts.list"]);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0]?.ok, true);
  // Derived from the registered host tool, never from provider-supplied names.
  assert.equal(result.toolCalls[0]?.readOnly, true);
});

test("voice mail-content request cannot fabricate inbox data without an authorized tool call", async () => {
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages,
    toolContext: { ...context, channel: "voice" }, requireEmailContentEvidence: true,
  }, {
    createRuntime: async () => fakeRuntime(["email.accounts.list", "email.messages.list"]),
    completeWithTools: async () => ({
      text: "I can see your Qdrant and Google emails from today.",
      toolCalls: [], finishReason: "stop",
    }),
    invoke: async () => { throw new Error("No tool should be invoked"); },
  });
  assert.equal(result.toolCalls.length, 0);
  assert.match(result.text, /couldn't retrieve your workspace email messages/);
  assert.doesNotMatch(result.text, /Qdrant|Google emails/);
});

test("voice mail-content request cannot treat account discovery as message retrieval", async () => {
  let count = 0;
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages,
    toolContext: { ...context, channel: "voice" }, requireEmailContentEvidence: true,
  }, {
    createRuntime: async () => fakeRuntime(["email.accounts.list", "email.messages.list"]),
    completeWithTools: async () => ++count === 1
      ? { text: "", toolCalls: [{ id: "accounts", name: "email.accounts.list", arguments: {} }], finishReason: "tool_calls" }
      : { text: "You received 8 emails in the past 24 hours.", toolCalls: [], finishReason: "stop" },
    invoke: async () => okResult(),
  });
  assert.deepEqual(result.toolCalls.map(c => c.name), ["email.accounts.list"]);
  assert.match(result.text, /couldn't retrieve/);
  assert.doesNotMatch(result.text, /8 emails/);
});

test("voice mail-content request may answer after a successful authorized message list", async () => {
  let count = 0;
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages,
    toolContext: { ...context, channel: "voice" }, requireEmailContentEvidence: true,
  }, {
    createRuntime: async () => fakeRuntime(["email.messages.list"]),
    completeWithTools: async () => ++count === 1
      ? { text: "", toolCalls: [{ id: "messages", name: "email.messages.list", arguments: { account_id: "mailbox-1" } }], finishReason: "tool_calls" }
      : { text: "An authorized message list is available.", toolCalls: [], finishReason: "stop" },
    invoke: async () => okResult(),
  });
  assert.equal(result.toolCalls[0]?.name, "email.messages.list");
  assert.equal(result.toolCalls[0]?.ok, true);
  assert.equal(result.text, "An authorized message list is available.");
});

test("email agent loop rejects a mismatched trusted tenant/agent context before model invocation", async () => {
  let modelCalled = false;
  await assert.rejects(() => runEmailAgentTurn({
    organizationId: "org-2", agentId: "agent-1", messages: inputMessages, toolContext: context,
  }, {
    createRuntime: async () => fakeRuntime(),
    completeWithTools: async () => { modelCalled = true; return { text: "", toolCalls: [], finishReason: "stop" }; },
    invoke: async () => okResult(),
  }), /does not match/);
  assert.equal(modelCalled, false);
});

test("email agent loop stops before exceeding the per-turn tool-call limit", async () => {
  let callCount = 0;
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages, toolContext: context, maxToolCalls: 1,
  }, {
    createRuntime: async () => fakeRuntime(),
    completeWithTools: async () => ({
      text: "", toolCalls: [
        { id: "call-1", name: "email.accounts.list", arguments: {} },
        { id: "call-2", name: "email.accounts.list", arguments: {} },
      ], finishReason: "tool_calls",
    }),
    invoke: async () => { callCount += 1; return okResult(); },
  });
  assert.equal(callCount, 1);
  assert.equal(result.finishReason, "tool_limit");
});


test("an approval-shaped result from a registered read tool cannot be marked safe to stream", async () => {
  let round = 0;
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages, toolContext: context,
  }, {
    createRuntime: async () => fakeRuntime(),
    completeWithTools: async () => {
      round += 1;
      return round === 1
        ? { text: "", toolCalls: [{ id: "call-1", name: "email.accounts.list", arguments: {} }], finishReason: "tool_calls" }
        : { text: "This operation requires approval.", toolCalls: [], finishReason: "stop" };
    },
    invoke: async () => ({
      ...okResult(),
      output: { status: "pending_approval", approval_required: true, action_id: "approval-1", action_type: "email.send" },
    }),
  });
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0]?.readOnly, false);
  assert.equal(result.pendingApprovals.length, 0, "a read-only handler cannot attest to a saved approval");
});

test("a completed safe read-only batch reaches the final text stream once the model stops requesting tools", async () => {
  let decisions = 0;
  let invoked = 0;
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages, toolContext: context,
    onSafeReadOnlyFinal: async (history) => {
      assert.equal(invoked, 1, "tool must be completed before text becomes visible");
      assert.equal(history.at(-1)?.role, "tool");
      return "Live answer delivered token by token";
    },
  }, {
    createRuntime: async () => fakeRuntime(),
    completeWithTools: async () => {
      decisions += 1;
      // Round 1: the model requests one read-only tool. Round 2: the model
      // has seen the result and stops requesting tools without final text,
      // so the hardened read-only writer delivers the answer.
      return decisions === 1
        ? { text: "", toolCalls: [{ id: "call-read", name: "email.accounts.list", arguments: {} }], finishReason: "tool_calls" }
        : { text: "", toolCalls: [], finishReason: "stop" };
    },
    invoke: async () => { invoked += 1; return okResult(); },
  });
  assert.equal(decisions, 2);
  assert.equal(result.streamed, true);
  assert.equal(result.text, "Live answer delivered token by token");
  assert.equal(result.toolCalls[0]?.readOnly, true);
  assert.deepEqual(result.pendingApprovals, []);
});

test("read-only discovery chains (accounts.list -> messages.list) are not cut off after the first batch", async () => {
  // Regression for the "no inbox contents were provided" answer: the model
  // must be allowed to finish its discovery chain (mailbox IDs, then the
  // message records themselves) before the final answer is generated.
  let decisions = 0;
  const invoked: string[] = [];
  let writerHistory: ToolChatMessage[] | null = null;
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1",
    messages: [{ role: "user", content: "Summarize my unread emails" }],
    toolContext: context,
    onSafeReadOnlyFinal: async (history) => {
      writerHistory = history;
      return "49 unread messages summarized";
    },
  }, {
    createRuntime: async () => fakeRuntime(["email.accounts.list", "email.messages.list"]),
    completeWithTools: async (_ctx, history, tools) => {
      decisions += 1;
      assert.equal(tools.length, 2);
      if (decisions === 1) {
        return { text: "", toolCalls: [{ id: "call-accounts", name: "email.accounts.list", arguments: {} }], finishReason: "tool_calls" };
      }
      if (decisions === 2) {
        // The accounts.list result must already be in history so the model
        // can chain the message-list call with the discovered account_id.
        assert.ok(history.some((message) => message.role === "tool" && message.tool_call_id === "call-accounts"));
        return { text: "", toolCalls: [{ id: "call-messages", name: "email.messages.list", arguments: { account_id: "mailbox-1", unread_only: true } }], finishReason: "tool_calls" };
      }
      assert.ok(history.some((message) => message.role === "tool" && message.tool_call_id === "call-messages"));
      return { text: "", toolCalls: [], finishReason: "stop" };
    },
    invoke: async (_runtime, name) => { invoked.push(name); return okResult(); },
  });
  assert.equal(decisions, 3);
  assert.deepEqual(invoked, ["email.accounts.list", "email.messages.list"]);
  assert.equal(result.streamed, true);
  assert.equal(result.text, "49 unread messages summarized");
  assert.equal(result.toolCalls.length, 2);
  assert.ok(result.toolCalls.every((call) => call.readOnly === true));
  // The final writer received BOTH completed tool results, not just the
  // account discovery record.
  assert.equal(writerHistory?.filter((message) => message.role === "tool").length, 2);
});

test("the model's own stopping-round answer text is used directly instead of regenerating it", async () => {
  let decisions = 0;
  let writerCalled = false;
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages, toolContext: context,
    onSafeReadOnlyFinal: async () => { writerCalled = true; return "regenerated"; },
  }, {
    createRuntime: async () => fakeRuntime(["email.accounts.list", "email.messages.list"]),
    completeWithTools: async () => {
      decisions += 1;
      return decisions === 1
        ? { text: "", toolCalls: [{ id: "call-accounts", name: "email.accounts.list", arguments: {} }], finishReason: "tool_calls" }
        : { text: "You have 49 unread emails in mailbox-1, most recently the ACME invoice.", toolCalls: [], finishReason: "stop" };
    },
    invoke: async () => okResult(),
  });
  assert.equal(decisions, 2);
  assert.equal(writerCalled, false);
  assert.equal(result.streamed, undefined);
  assert.equal(result.text, "You have 49 unread emails in mailbox-1, most recently the ACME invoice.");
  assert.equal(result.toolCalls[0]?.readOnly, true);
});

test("a denied tool result never enters the native final streaming path", async () => {
  let decisions = 0;
  let streamed = false;
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages, toolContext: context,
    onSafeReadOnlyFinal: async () => { streamed = true; return "unsafe"; },
  }, {
    createRuntime: async () => fakeRuntime(),
    completeWithTools: async () => (++decisions === 1
      ? { text: "", toolCalls: [{ id: "call-read", name: "email.accounts.list", arguments: {} }], finishReason: "tool_calls" }
      : { text: "Access denied.", toolCalls: [], finishReason: "stop" }),
    invoke: async () => ({
      ok: false, error: { code: "permission_denied", message: "No access", retryable: false },
      audit: { tool_name: "email.accounts.list", input_summary: "", output_summary: "denied", duration_ms: 1 },
    }),
  });
  assert.equal(streamed, false);
  assert.equal(decisions, 2);
  assert.equal(result.streamed, undefined);
  assert.equal(result.toolCalls[0]?.readOnly, false);
});

test("a pending-approval result must never trigger direct read-only final streaming", async () => {
  let round = 0;
  let streamingCalled = false;
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1", messages: inputMessages, toolContext: context,
    onSafeReadOnlyFinal: async () => { streamingCalled = true; return "sent"; },
  }, {
    createRuntime: async () => fakeRuntime(),
    completeWithTools: async () => (++round === 1
      ? { text: "", toolCalls: [{ id: "call-read", name: "email.accounts.list", arguments: {} }], finishReason: "tool_calls" }
      : { text: "Pending approval; not sent.", toolCalls: [], finishReason: "stop" }),
    invoke: async () => ({
      ok: true, output: { status: "pending_approval", action_id: "approval-1", action_type: "email.send" },
      audit: { tool_name: "email.accounts.list", input_summary: "", output_summary: "pending", duration_ms: 1 },
    }),
  });
  assert.equal(streamingCalled, false);
  assert.equal(result.toolCalls[0]?.readOnly, false);
  assert.equal(result.pendingApprovals.length, 0);
});

test('mutation receipts are tied to the current trusted turn, call and returned saved ID',async()=>{
 const id='dd0facf7-80c6-4c39-b9be-9a7a94614739';
 const runtime=fakeRuntime(['email.draft.create']);
 runtime.registry.register({name:'email.draft.create',domain:'email',description:'Save draft',input_schema:{type:'object',properties:{}},required_permission:'email.write',sensitivity:'sensitive',execute:async()=>okResult()});
 let round=0;
 const result=await runEmailAgentTurn({organizationId:'org-1',agentId:'agent-1',messages:[...inputMessages,{role:'assistant',content:'A different old draft was saved'}],toolContext:{...context,auth_subject:{...context.auth_subject,permissions:['email.write']}}},{
  createRuntime:async()=>runtime,
  completeWithTools:async()=>++round===1?{text:'',toolCalls:[{id:'actual-call',name:'email.draft.create',arguments:{}}],finishReason:'tool_calls'}:{text:'Done',toolCalls:[],finishReason:'stop'},
  invoke:async()=>({...okResult(),output:{status:'draft_created',draft_id:id}}),
 });
 assert.deepEqual(result.toolCalls[0]?.operation,{channel:'email',operation:'draft',state:'draft_saved',turnId:'turn-1',callId:'actual-call',correlationId:'corr-1',resourceId:id});
});


test("voice and chat model receive only actor-authorized persisted email tool definitions", async () => {
  const runtime = fakeRuntime(["email.accounts.list", "email.draft.create"]);
  runtime.registry.register({
    name: "email.draft.create", domain: "email", description: "Save an email draft",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    required_permission: "email.write", sensitivity: "safe",
    execute: async () => okResult(),
  });
  let exposed: string[] = [];
  const result = await runEmailAgentTurn({
    organizationId: "org-1", agentId: "agent-1",
    messages: [{ role: "user", content: "Draft an email" }], toolContext: context,
  }, {
    createRuntime: async () => runtime,
    completeWithTools: async (_ctx, _history, definitions) => {
      exposed = definitions.map(tool => tool.name);
      return { text: "An email.write grant is required to create a draft.", toolCalls: [], finishReason: "stop" };
    },
    invoke: async () => { throw new Error("No write tool should run"); },
  });
  assert.deepEqual(exposed, ["email.accounts.list"]);
  assert.match(result.text, /email.write/);
});
