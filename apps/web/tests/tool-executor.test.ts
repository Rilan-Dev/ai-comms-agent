import { describe, expect, it, vi } from "vitest";
import { ToolRegistry } from "../../../packages/shared/src/agent/registry";
import type { Tool, ToolContext } from "../../../packages/shared/src/agent/types";
import { executeRegisteredTool } from "../../../apps/worker/src/agent/tool-executor";

const context: ToolContext = {
  agent_id: "agent-1", organization_id: "org-1", user_id: "user-1",
  conversation_id: "conversation-1", turn_id: "turn-1", correlation_id: "corr-1",
  channel: "chat", auth_subject: { user_id: "user-1", role: "member", permissions: ["kb.read"] },
};
function makeTool(): Tool {
  return {
    name: "kb.search", domain: "kb", description: "Search knowledge.",
    input_schema: { type: "object", properties: { query: { type: "string", minLength: 1 } }, required: ["query"], additionalProperties: false },
    sensitivity: "safe", required_permission: "kb.read",
    execute: vi.fn(async () => ({ ok: true, output: { count: 1 }, audit: { tool_name: "kb.search", input_summary: "kb.search", output_summary: "1 result", duration_ms: 1 } })),
  };
}

describe("executeRegisteredTool", () => {
  it('does not acquire a newly enabled tool during a frozen turn',async()=>{
    const registry=new ToolRegistry(()=>['kb.search']);const tool=makeTool();registry.register(tool);
    const frozen={...context,agent_configuration:{organizationId:context.organization_id,agentId:context.agent_id,revisionId:'revision',snapshot:{lifecycle:{status:'active'},policy:{allowedTools:[],securityPolicy:{}}} as never}};
    const outcome=await executeRegisteredTool(registry,'kb.search',{query:'mail'},frozen,vi.fn(async()=>({allowed:true})),vi.fn(async()=>{}));
    expect(outcome.error?.code).toBe('tool_not_allowed');expect(tool.execute).not.toHaveBeenCalled();
  });
  it('retains human review when automatic sending was off at the start of the turn',async()=>{
    const registry=new ToolRegistry(()=>['kb.search']);const tool=makeTool();registry.register(tool);
    const frozen={...context,agent_configuration:{organizationId:context.organization_id,agentId:context.agent_id,revisionId:'revision',snapshot:{lifecycle:{status:'active'},policy:{allowedTools:['kb.search'],securityPolicy:{autonomous_send:false}}} as never}};
    const outcome=await executeRegisteredTool(registry,'kb.search',{query:'mail'},frozen,vi.fn(async()=>({allowed:true})),vi.fn(async()=>{}));
    expect(outcome.ok).toBe(true);expect(tool.execute).toHaveBeenCalledWith({query:'mail'},expect.objectContaining({require_human_approval:true}));
  });
  it('rejects frozen configuration from another scope before host authorization',async()=>{
    const registry=new ToolRegistry(()=>['kb.search']);const tool=makeTool();registry.register(tool);const authorize=vi.fn(async()=>({allowed:true}));
    const frozen={...context,agent_configuration:{organizationId:'other',agentId:context.agent_id,revisionId:'revision',snapshot:{lifecycle:{status:'active'},policy:{allowedTools:['kb.search'],securityPolicy:{}}} as never}};
    expect((await executeRegisteredTool(registry,'kb.search',{query:'mail'},frozen,authorize,vi.fn(async()=>{}))).ok).toBe(false);expect(authorize).not.toHaveBeenCalled();expect(tool.execute).not.toHaveBeenCalled();
  });
  it("fails closed when the agent allowlist excludes the tool", async () => {
    const registry = new ToolRegistry(() => []);
    const handler = makeTool();
    registry.register(handler);
    const writeAudit = vi.fn(async () => undefined);
    const result = await executeRegisteredTool(registry, "kb.search", { query: "mail" }, context, vi.fn(async () => ({ allowed: true })), writeAudit);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("tool_not_allowed");
    expect(handler.execute).not.toHaveBeenCalled();
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });

  it("asks the host authorizer before executing a valid call", async () => {
    const registry = new ToolRegistry(() => ["kb.search"]);
    const handler = makeTool();
    registry.register(handler);
    const authorize = vi.fn(async () => ({ allowed: false, code: "account_denied", message: "No grant." }));
    const writeAudit = vi.fn(async () => undefined);
    const result = await executeRegisteredTool(registry, "kb.search", { query: "mail" }, context, authorize, writeAudit);
    expect(result.error?.code).toBe("account_denied");
    expect(handler.execute).not.toHaveBeenCalled();
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid input before authorization", async () => {
    const registry = new ToolRegistry(() => ["kb.search"]);
    const handler = makeTool();
    registry.register(handler);
    const authorize = vi.fn(async () => ({ allowed: true }));
    const writeAudit = vi.fn(async () => undefined);
    const result = await executeRegisteredTool(registry, "kb.search", { extra: true }, context, authorize, writeAudit);
    expect(result.error?.code).toBe("invalid_input");
    expect(authorize).not.toHaveBeenCalled();
    expect(handler.execute).not.toHaveBeenCalled();
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });
});
