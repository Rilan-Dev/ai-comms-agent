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
