import { ToolRegistry } from "@ai-comms-agent/shared";
import type { Tool, ToolContext, ToolResult } from "@ai-comms-agent/shared";

export interface ToolAuthorizationDecision {
  allowed: boolean;
  code?: string;
  message?: string;
  retryable?: boolean;
}
export type ToolAuthorizer = (tool: Tool, input: unknown, context: ToolContext) => Promise<ToolAuthorizationDecision>;
export type ToolAuditWriter = (toolName: string, tool: Tool | null, context: ToolContext, result: ToolResult) => Promise<void>;

function failure(toolName: string, code: string, message: string, retryable = false): ToolResult {
  return {
    ok: false,
    error: { code, message, retryable },
    audit: { tool_name: toolName, input_summary: toolName, output_summary: code, duration_ms: 0 },
  };
}

/**
 * Shared invocation pipeline for all transports. The caller must supply a
 * trusted authorizer (account binding, provider capability and policy/approval)
 * and a durable audit writer. If either is missing, no handler is invoked.
 */
export async function executeRegisteredTool(
  registry: ToolRegistry,
  toolName: string,
  input: unknown,
  context: ToolContext,
  authorize: ToolAuthorizer,
  writeAudit: ToolAuditWriter,
): Promise<ToolResult> {
  const startedAt = Date.now();
  const tool = registry.get(toolName);
  let outcome: ToolResult;

  if (!tool) {
    outcome = failure(toolName, "unknown_tool", "This tool is not registered.");
  } else if (!registry.listForAgent(context.agent_id).some((candidate) => candidate.name === toolName)) {
    outcome = failure(toolName, "tool_not_allowed", "This tool is not enabled for the current agent.");
  } else {
    const validation = registry.validate(toolName, input);
    if (!validation.valid) {
      outcome = failure(toolName, "invalid_input", (validation.errors ?? []).slice(0, 5).join("; "));
    } else if (!context.auth_subject.permissions.includes(tool.required_permission)) {
      outcome = failure(toolName, "permission_denied", "The current actor lacks the required permission.");
    } else {
      try {
        const decision = await authorize(tool, input, context);
        if (!decision.allowed) {
          outcome = failure(toolName, decision.code ?? "execution_denied", decision.message ?? "The operation was not authorized.", decision.retryable ?? false);
        } else {
          try {
            outcome = await tool.execute(input, context);
          } catch {
            outcome = failure(toolName, "tool_execution_failed", "The operation could not be completed.");
          }
        }
      } catch {
        outcome = failure(toolName, "authorization_unavailable", "Authorization could not be confirmed; the operation was not executed.");
      }
    }
  }

  outcome.audit.duration_ms = Math.max(outcome.audit.duration_ms, Date.now() - startedAt);
  try {
    await writeAudit(toolName, tool, context, outcome);
  } catch {
    // A handler may have completed before audit persistence failed. Do not
    // suggest automatic retry; callers must reconcile any possible side effect.
    return failure(toolName, "audit_persistence_failed", "The audit record could not be persisted. Reconcile the operation before retrying.");
  }
  return outcome;
}
