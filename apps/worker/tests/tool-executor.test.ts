import test from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "@ai-comms-agent/shared";
import type { Tool, ToolContext, ToolResult } from "@ai-comms-agent/shared";
import { executeRegisteredTool } from "../src/agent/tool-executor";

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

function makeTool(): Tool {
  return {
    name: "email.accounts.list",
    domain: "email",
    description: "List agent-bound mailboxes.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    sensitivity: "safe",
    required_permission: "email.read",
    execute: async () => ({
      ok: true,
      output: [{ id: "account-1" }],
      audit: { tool_name: "email.accounts.list", input_summary: "email.accounts.list", output_summary: "1 result", duration_ms: 1 },
    }),
  };
}

function setup(allowed: string[] | null = ["email.accounts.list"]) {
  const registry = new ToolRegistry(() => allowed);
  registry.register(makeTool());
  const audited: Array<{ name: string; result: ToolResult }> = [];
  const writeAudit = async (name: string, _tool: Tool | null, _context: ToolContext, result: ToolResult) => {
    audited.push({ name, result });
  };
  return { registry, audited, writeAudit };
}

test("executor validates, authorizes, executes and audits a registered tool", async () => {
  const { registry, audited, writeAudit } = setup();
  const result = await executeRegisteredTool(registry, "email.accounts.list", {}, context, async () => ({ allowed: true }), writeAudit);
  assert.equal(result.ok, true);
  assert.equal(audited.length, 1);
  assert.equal(audited[0]?.result.ok, true);
});

test("executor fails closed and audits a missing agent allowlist", async () => {
  const { registry, audited, writeAudit } = setup(null);
  let executed = false;
  const tool = registry.get("email.accounts.list");
  assert.ok(tool);
  tool.execute = async () => { executed = true; return { ok: true, audit: { tool_name: tool.name, input_summary: "", output_summary: "", duration_ms: 0 } }; };
  const result = await executeRegisteredTool(registry, tool.name, {}, context, async () => ({ allowed: true }), writeAudit);
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "tool_not_allowed");
  assert.equal(executed, false);
  assert.equal(audited.length, 1);
});

test("executor denies malformed inputs and missing actor permissions before execution", async () => {
  const { registry, audited, writeAudit } = setup();
  const invalid = await executeRegisteredTool(registry, "email.accounts.list", { unexpected: true }, context, async () => ({ allowed: true }), writeAudit);
  assert.equal(invalid.error?.code, "invalid_input");
  const noPermission = { ...context, auth_subject: { ...context.auth_subject, permissions: [] } };
  const denied = await executeRegisteredTool(registry, "email.accounts.list", {}, noPermission, async () => ({ allowed: true }), writeAudit);
  assert.equal(denied.error?.code, "permission_denied");
  assert.equal(audited.length, 2);
});

test("executor records authorization denial and fails closed when audit persistence fails", async () => {
  const { registry, audited, writeAudit } = setup();
  const denied = await executeRegisteredTool(registry, "email.accounts.list", {}, context, async () => ({ allowed: false, code: "policy_denied" }), writeAudit);
  assert.equal(denied.error?.code, "policy_denied");
  const auditFailure = await executeRegisteredTool(registry, "email.accounts.list", {}, context, async () => ({ allowed: true }), async () => { throw new Error("audit offline"); });
  assert.equal(auditFailure.error?.code, "audit_persistence_failed");
  assert.equal(audited.length, 1);
});

test("executor audits unexpected model-emitted tool names as unknown", async () => {
  const { registry, audited, writeAudit } = setup();
  const result = await executeRegisteredTool(registry, "email.send.unexpected", {}, context, async () => ({ allowed: true }), writeAudit);
  assert.equal(result.error?.code, "unknown_tool");
  assert.equal(audited.length, 1);
  assert.equal(audited[0]?.name, "email.send.unexpected");
});
