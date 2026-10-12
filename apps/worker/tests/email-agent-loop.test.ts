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
