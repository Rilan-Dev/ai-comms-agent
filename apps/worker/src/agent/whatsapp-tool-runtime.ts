import { PostgresAgentRepository, query, recordAuditEvent } from "@ai-comms-agent/db";
import { ToolRegistry } from "@ai-comms-agent/shared";
import type { Tool, ToolContext, ToolResult } from "@ai-comms-agent/shared";
import { executeRegisteredTool } from "./tool-executor";
import type { ToolAuthorizationDecision, ToolAuditWriter } from "./tool-executor";

type WhatsAppHistoryInput = { account_id?: string; contact_phone?: string; limit?: number };
type WhatsAppHistoryRow = { id: string; whatsapp_account_id: string; direction: string; message_type: string; body: string | null; status: string; provider_timestamp: string | null; created_at: string; phone_number: string | null; display_name: string | null };

function toolResult(output: unknown, startedAt: number, error?: { code: string; message: string; retryable: boolean }): ToolResult {
  return { ok: !error, ...(output === undefined ? {} : { output }), ...(error ? { error } : {}), audit: { tool_name: "whatsapp.history", input_summary: "whatsapp.history", output_summary: error ? error.code : `whatsapp.history: ${Array.isArray(output) ? output.length : 0} message(s)`, duration_ms: Math.max(0, Date.now() - startedAt) } };
}

export function createWhatsAppHistoryTool(): Tool<WhatsAppHistoryInput, WhatsAppHistoryRow[]> {
  return { name: "whatsapp.history", domain: "messaging", description: "Read recent WhatsApp messages from an account explicitly connected to this agent. Optionally filter by account ID or contact phone number.",
    input_schema: { type: "object", properties: { account_id: { type: "string", minLength: 1, maxLength: 128 }, contact_phone: { type: "string", minLength: 8, maxLength: 20 }, limit: { type: "integer", minimum: 1, maximum: 50 } }, additionalProperties: false },
    sensitivity: "safe", required_permission: "whatsapp.read",
    execute: async (input, context) => {
      const startedAt = Date.now();
      if (!context.auth_subject.permissions.includes("whatsapp.read")) return toolResult(undefined, startedAt, { code: "permission_denied", message: "The current actor is not authorized to read WhatsApp history.", retryable: false });
      const accountId = typeof input.account_id === "string" ? input.account_id.trim() : "";
      const contactPhone = typeof input.contact_phone === "string" ? input.contact_phone.trim() : "";
      const limit = Number.isInteger(input.limit) ? Math.min(Math.max(input.limit as number, 1), 50) : 20;
      const result = await query<WhatsAppHistoryRow>(
        `SELECT m.id, m.whatsapp_account_id, m.direction, m.message_type, m.body, m.status, m.provider_timestamp, m.created_at, c.phone_number, c.display_name
         FROM whatsapp_messages m
         JOIN whatsapp_accounts w ON w.id = m.whatsapp_account_id AND w.organization_id = $1 AND w.status = 'connected' AND w.deleted_at IS NULL
         JOIN agent_whatsapp_accounts b ON b.whatsapp_account_id = w.id AND b.agent_id = $2
         JOIN agents a ON a.id = b.agent_id AND a.organization_id = $1
         LEFT JOIN whatsapp_contacts c ON c.id = m.contact_id AND c.whatsapp_account_id = w.id AND c.organization_id = $1
         WHERE m.organization_id = $1 AND m.whatsapp_account_id = w.id AND ($3 = '' OR w.id::text = $3) AND ($4 = '' OR c.phone_number = $4)
         ORDER BY m.created_at DESC LIMIT $5`,
        [context.organization_id, context.agent_id, accountId, contactPhone, limit],
      );
      const safeRows = result.rows.map((row) => ({ ...row, body: typeof row.body === "string" ? row.body.slice(0, 4000) : null }));
      return toolResult(safeRows, startedAt);
    }, timeout_ms: 5000, retryable: true, idempotent: true
  };
}

export interface WhatsAppToolRuntime { registry: ToolRegistry; authorize: (tool: Tool, input: unknown, context: ToolContext) => Promise<ToolAuthorizationDecision>; writeAudit: ToolAuditWriter; }

/** Missing policy and revoked allowlist entries fail closed. Outbound send stays unregistered until WhatsApp approval and template compliance exist. */
export async function createWhatsAppToolRuntime(organizationId: string, agentId: string): Promise<WhatsAppToolRuntime> {
  const agents = new PostgresAgentRepository();
  const policy = await agents.policy(organizationId, agentId);
  const allowedTools = policy?.allowedTools ?? [];
  const registry = new ToolRegistry((requestedAgentId) => requestedAgentId === agentId ? allowedTools : null);
  registry.register(createWhatsAppHistoryTool());
  const authorize: WhatsAppToolRuntime["authorize"] = async (tool, _input, context) => {
    if (context.organization_id !== organizationId || context.agent_id !== agentId) return { allowed: false, code: "context_mismatch", message: "The tool context does not match the initialized agent runtime." };
    const currentPolicy = await agents.policy(organizationId, agentId);
    if (!currentPolicy?.allowedTools.includes(tool.name)) return { allowed: false, code: "tool_not_allowed", message: "This tool is not enabled for the current agent." };
    if (tool.sensitivity !== "safe") return { allowed: false, code: "approval_required", message: "This operation requires a dedicated WhatsApp approval workflow that is not registered in this runtime." };
    return { allowed: true };
  };
  const writeAudit: ToolAuditWriter = async (toolName, tool, context, outcome) => {
    await recordAuditEvent({ organizationId: context.organization_id, actorUserId: context.user_id, agentId: context.agent_id, eventType: "agent.tool_call", targetType: tool?.domain ?? "tool", action: toolName, decision: outcome.ok ? "allow" : (outcome.error?.code ?? "deny"), correlationId: context.correlation_id, metadata: { channel: context.channel, tool_name: toolName, success: outcome.ok, error_code: outcome.error?.code ?? null, duration_ms: outcome.audit.duration_ms } });
  };
  return { registry, authorize, writeAudit };
}

export async function invokeWhatsAppTool(runtime: WhatsAppToolRuntime, toolName: string, input: unknown, context: ToolContext) { return executeRegisteredTool(runtime.registry, toolName, input, context, runtime.authorize, runtime.writeAudit); }