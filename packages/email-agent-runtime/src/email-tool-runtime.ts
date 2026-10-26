import {
  PostgresAgentRepository,
  PostgresEmailAccountRepository,
  query,
  recordAuditEvent,
  assertCurrentAgentToolAuthorization,
} from "@ai-comms-agent/db";
import { EMAIL_TOOL_CATALOG, ToolRegistry,turnAllowsTool,turnAllowsEmailAccount } from "@ai-comms-agent/shared";
import type { ToolContext } from "@ai-comms-agent/shared";
import { registerEmailReadTools } from "./email-read-tools";
import { registerEmailWriteTools } from "./email-write-tools";
import { canUseEmailAccountBinding, hasEmailToolCapabilities, isEmailToolAllowedByPolicy } from "./email-tool-policy";
import { executeRegisteredTool } from "./tool-executor";
import { resolveAccountIdentifier } from "./account-identifier";
import type { ToolAuthorizationDecision, ToolAuditWriter } from "./tool-executor";

export interface EmailToolRuntime {
  registry: ToolRegistry;
  authorize: (tool: import("@ai-comms-agent/shared").Tool, input: unknown, context: ToolContext) => Promise<ToolAuthorizationDecision>;
  writeAudit: ToolAuditWriter;
}

/**
 * Build an agent-scoped view of the shared registry. Create this runtime per turn/request
 * so persisted allowlist changes are reloaded; missing policy fails closed.
 */
export async function createEmailToolRuntime(organizationId: string, agentId: string): Promise<EmailToolRuntime> {
  const agents = new PostgresAgentRepository();
  const accountRepository = new PostgresEmailAccountRepository();
  const policy = await agents.policy(organizationId, agentId);
  const allowedTools = policy?.allowedTools ?? [];
  const registry = new ToolRegistry((requestedAgentId) => requestedAgentId === agentId ? allowedTools : null);
  registerEmailReadTools((tool) => registry.register(tool), { accounts: accountRepository, agents });
  registerEmailWriteTools((tool) => registry.register(tool), { accounts: accountRepository });

  const authorize: EmailToolRuntime["authorize"] = async (tool, input, context) => {
    if (context.organization_id !== organizationId || context.agent_id !== agentId) {
      return { allowed: false, code: "context_mismatch", message: "The tool context does not match the initialized agent runtime." };
    }
    if(!turnAllowsTool(context,tool.name))return {allowed:false,code:'tool_not_allowed',message:'This tool was not enabled when the turn started.'};
    if(context.agent_configuration){
      try{await assertCurrentAgentToolAuthorization({organizationId,agentId,userId:context.user_id,revocationGeneration:context.agent_configuration.revocationGeneration??-1},tool.required_permission);}
      catch{return {allowed:false,code:'current_access_revoked',message:'Current access changed or could not be confirmed. Start a new turn after reviewing the agent configuration.'};}
    }
    // Re-read persisted policy for every invocation so a revoked allowlist entry
    // is not honored for the remainder of a long-running model turn.
    const currentPolicy = await agents.policy(organizationId, agentId);
    if (!isEmailToolAllowedByPolicy(currentPolicy, tool.name)) {
      return { allowed: false, code: "tool_not_allowed", message: "This tool is not enabled for the current agent." };
    }
    if (tool.sensitivity !== "safe") {
      return { allowed: false, code: "approval_required", message: "This operation requires a dedicated approval workflow that is not registered in this runtime." };
    }

    const value = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
    const accountId = typeof value.account_id === "string" ? value.account_id.trim() : "";
    if (accountId) {
      // Resolve BEFORE any uuid-typed query. The model often passes the
      // mailbox address (e.g. "user@gmail.com") instead of the UUID from
      // email.accounts.list; a raw uuid comparison would throw
      // "invalid input syntax for type uuid" and surface as the cryptic
      // authorization_unavailable error. Unresolvable identifiers get a
      // clean account_not_available denial instead of an exception.
      const resolvedAccountId = await resolveAccountIdentifier(organizationId, agentId, accountId);
      if (!resolvedAccountId) {
        return { allowed: false, code: "account_not_available", message: "No mailbox matching that identifier is bound to this agent. Call email.accounts.list to discover the available mailbox IDs." };
      }
      const operation=tool.required_permission==='email.read'?'read':/^email\.(?:send|reply|forward)\.request$/.test(tool.name)?'send':'draft';
      if(!turnAllowsEmailAccount(context,resolvedAccountId,operation))return {allowed:false,code:'account_not_available',message:'This mailbox did not allow this operation when the turn started.'};
      const binding = await query<{ role: string }>(
        `SELECT b.role FROM agent_email_accounts b
         JOIN agents g ON g.id=b.agent_id
         JOIN email_accounts a ON a.id=b.email_account_id
         WHERE g.id=$1 AND g.organization_id=$2 AND a.id=$3
           AND a.organization_id=$2 AND a.deleted_at IS NULL
         LIMIT 1`,
        [agentId, organizationId, resolvedAccountId],
      );
      const role = binding.rows[0]?.role;
      if (!canUseEmailAccountBinding(role, tool.required_permission)) {
        return { allowed: false, code: "account_not_available", message: "This mailbox binding does not permit the requested operation." };
      }
      const account = await accountRepository.getForAgent(organizationId, agentId, resolvedAccountId);
      if (!account) return { allowed: false, code: "account_not_available", message: "This mailbox is not bound to this agent." };
      const descriptor = EMAIL_TOOL_CATALOG.find((item) => item.name === tool.name);
      const capabilities = account.capabilities as Record<string, boolean>;
      if (descriptor && !hasEmailToolCapabilities(descriptor, capabilities)) {
        return { allowed: false, code: "capability_not_supported", message: "This mailbox does not support the required capabilities for the requested operation." };
      }
      if (!descriptor && tool.required_capability && capabilities[tool.required_capability] !== true) {
        return { allowed: false, code: "capability_not_supported", message: "This mailbox does not support the requested operation." };
      }
    }
    return { allowed: true };
  };

  const writeAudit: ToolAuditWriter = async (toolName, tool, context, result) => {
    await recordAuditEvent({
      organizationId: context.organization_id,
      actorUserId: context.user_id,
      agentId: context.agent_id,
      eventType: "agent.tool_call",
      targetType: tool?.domain ?? "tool",
      action: toolName,
      decision: result.ok ? "allow" : (result.error?.code ?? "deny"),
      correlationId: context.correlation_id,
      metadata: {
        channel: context.channel,
        tool_name: toolName,
        success: result.ok,
        error_code: result.error?.code ?? null,
        duration_ms: result.audit.duration_ms,
      },
    });
  };

  return { registry, authorize, writeAudit };
}

export async function invokeEmailReadTool(
  runtime: EmailToolRuntime,
  toolName: string,
  input: unknown,
  context: ToolContext,
) {
  return executeRegisteredTool(runtime.registry, toolName, input, context, runtime.authorize, runtime.writeAudit);
}
