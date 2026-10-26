import { PostgresAgentRepository, query, queueWhatsAppOutboundMessage, recordAuditEvent } from "@ai-comms-agent/db";
import { isAutonomousSendEnabled } from "@ai-comms-agent/shared";
import { ToolRegistry } from "@ai-comms-agent/shared";
import type { Tool, ToolContext, ToolResult } from "@ai-comms-agent/shared";
import { executeRegisteredTool } from "./tool-executor";
import type { ToolAuthorizationDecision, ToolAuditWriter } from "./tool-executor";

type WhatsAppHistoryInput = { account_id?: string; contact_phone?: string; limit?: number };
type WhatsAppSendApprovalInput = {
  account_id?: string;
  to: string;
  payload_type: "text" | "template";
  body?: string;
  template_name?: string;
  template_language?: string;
  template_parameters?: string[];
};
type WhatsAppHistoryRow = { id: string; whatsapp_account_id: string; direction: string; message_type: string; body: string | null; status: string; provider_timestamp: string | null; created_at: string; phone_number: string | null; display_name: string | null };
type AutoApprovalOutcome =
  | { kind: "queued"; messageId: string | null }
  | { kind: "skipped" }
  | { kind: "failed"; code: string; message: string };

/** Autonomous-send policy: when the agent's saved policy enables it, the
 * just-created pending proposal is approved and queued immediately instead of
 * waiting for a human decision. The same Meta rules the manual decision route
 * enforces still apply here: free-form text needs an inbound customer message
 * in the last 24 hours; templates must be approved. The requesting actor must
 * hold whatsapp.send (re-verified by the worker at dispatch). */
async function autoApproveWhatsAppSendAction(args: {
  organizationId: string;
  agentId: string;
  accountId: string;
  actionId: string;
  requestedBy: string | null;
  recipientPhone: string;
  messageBody: string;
  payloadType: "text" | "template";
  templateName: string | null;
  templateLanguage: string | null;
  templateParameters: string[];
  idempotencyKey: string;
  correlationId: string | null;
  requireHumanApproval?:boolean;
}): Promise<AutoApprovalOutcome> {
  if(args.requireHumanApproval)return {kind:"skipped"};
  const policy = await new PostgresAgentRepository().policy(args.organizationId, args.agentId);
  if (!isAutonomousSendEnabled(policy?.securityPolicy)) return { kind: "skipped" };
  if (args.payloadType === "text") {
    const inbound = await query<{ id: string }>(
      `SELECT m.id FROM whatsapp_messages m
       JOIN whatsapp_contacts c ON c.id=m.contact_id
       WHERE m.organization_id=$1 AND m.whatsapp_account_id=$2
         AND c.phone_number=$3 AND m.direction='inbound'
         AND COALESCE(m.provider_timestamp,m.created_at) >= now() - interval '24 hours'
         AND COALESCE(m.provider_timestamp,m.created_at) <= now()
       ORDER BY COALESCE(m.provider_timestamp,m.created_at) DESC LIMIT 1`,
      [args.organizationId, args.accountId, args.recipientPhone],
    );
    if (!inbound.rows.length) {
      await query(
        "UPDATE whatsapp_send_actions SET status='requires_template', updated_at=now() WHERE id=$1 AND organization_id=$2 AND status IN ('pending','approved')",
        [args.actionId, args.organizationId],
      );
      return { kind: "failed", code: "template_required", message: "No inbound customer message was received in the last 24 hours. Meta requires an approved message template outside that window; no free-form text was queued." };
    }
  }
  const approved = await query<{ id: string }>(
    "UPDATE whatsapp_send_actions SET status='approved', approved_by=$3, approved_at=now(), updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='pending' RETURNING id",
    [args.actionId, args.organizationId, args.requestedBy],
  );
  if (!approved.rows.length) return { kind: "skipped" };
  const messageId = await queueWhatsAppOutboundMessage({
    organizationId: args.organizationId,
    accountId: args.accountId,
    to: args.recipientPhone,
    body: args.messageBody,
    messageType: args.payloadType === "template" ? "template" : "text",
    media: args.payloadType === "template"
      ? { template: { name: args.templateName ?? "", language: args.templateLanguage ?? "", parameters: args.templateParameters } }
      : {},
    idempotencyKey: args.idempotencyKey,
    correlationId: args.correlationId,
  });
  const outcome = await query<{ status: string }>(
    "UPDATE whatsapp_send_actions SET status=CASE WHEN status='approved' THEN 'queued' ELSE status END, queued_message_id=COALESCE(queued_message_id,$3), updated_at=now() WHERE id=$1 AND organization_id=$2 AND status IN ('approved','queued','sent','failed','requires_template') RETURNING status",
    [args.actionId, args.organizationId, messageId],
  );
  const _outcomeStatus = outcome.rows[0]?.status ?? "queued";
  void _outcomeStatus;
  return { kind: "queued", messageId };
}

function toolResult(output: unknown, startedAt: number, error?: { code: string; message: string; retryable: boolean }): ToolResult<any> {
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

export function createWhatsAppSendApprovalTool(): Tool<WhatsAppSendApprovalInput, { approval_required: boolean; auto_approved?: boolean; action_id: string; status: string; message_id?: string; message?: string }> {
  return {
    name: "whatsapp.send",
    domain: "messaging",
    description: "Request a WhatsApp send. The sole connected agent-bound phone is selected automatically; do not ask the user for internal IDs. If necessary pass the phone's visible label or number as account_id. Depending on this agent's saved policy the request either queues automatically (autonomous sending) or waits for human approval; the tool result reports which happened. Free-form text requires Meta's active 24-hour customer-service window; otherwise select an approved template.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string", minLength: 1, maxLength: 128 },
        to: { type: "string", minLength: 9, maxLength: 16 },
        payload_type: { type: "string", enum: ["text", "template"] },
        body: { type: "string", minLength: 1, maxLength: 4096 },
        template_name: { type: "string", minLength: 1, maxLength: 512 },
        template_language: { type: "string", minLength: 2, maxLength: 32 },
        template_parameters: { type: "array", maxItems: 20, items: { type: "string", maxLength: 1024 } },
      },
      required: ["to", "payload_type"],
      additionalProperties: false,
    },
    sensitivity: "sensitive",
    required_permission: "whatsapp.send",
    execute: async (input, context) => {
      const startedAt = Date.now();
      const fail = (code: string, message: string): ToolResult<{ approval_required: true; action_id: string; status: string }> => ({
        ok: false, error: { code, message, retryable: false },
        audit: { tool_name: "whatsapp.send", input_summary: "whatsapp.send approval proposal", output_summary: code, duration_ms: Math.max(0, Date.now() - startedAt) },
      });
      if (!/^\+[1-9]\d{7,14}$/.test(input.to)) return fail("invalid_recipient", "Recipient must be an E.164 phone number.");
      if (input.payload_type === "text" && (!input.body?.trim() || input.body.length > 4096)) return fail("invalid_message", "A text message of 1–4096 characters is required.");
      if (input.payload_type === "template" && (!input.template_name || !/^[a-z0-9_]{1,512}$/.test(input.template_name) || !input.template_language)) return fail("invalid_template", "A template name and language are required.");
      if (!context.auth_subject.permissions.includes("whatsapp.send")) return fail("permission_denied", "The current actor cannot request WhatsApp sends.");
      const selection = await resolveWhatsAppSendAccount(context.organization_id, context.agent_id, input.account_id);
      if (selection.accountId === null) return fail(selection.code, selection.message);
      const accountId=selection.accountId;
      const templateParameters = Array.isArray(input.template_parameters) ? input.template_parameters : [];
      if (input.payload_type === "template") {
        const template = await query<{ components: unknown }>(
          "SELECT components FROM whatsapp_templates WHERE organization_id=$1 AND whatsapp_account_id=$2 AND name=$3 AND language=$4 AND status='approved' LIMIT 1",
          [context.organization_id, accountId, input.template_name, input.template_language],
        );
        if (!template.rows.length) return fail("template_not_approved", "Only a template synchronized from Meta with approved status can be requested.");
        const approvedTemplate = template.rows[0];
        if (!approvedTemplate) return fail("template_not_approved", "Only a template synchronized from Meta with approved status can be requested.");
        const components = approvedTemplate.components;
        const componentList = Array.isArray(components) ? components.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
        if (componentList.some((item) => item.type === "BUTTONS" || (item.type === "HEADER" && ((typeof item.format === "string" ? item.format : "TEXT") !== "TEXT" || (typeof item.text === "string" && /\{\{\d+\}\}/.test(item.text)))))) {
          return fail("unsupported_template_components", "This sender supports approved text templates with body parameters only.");
        }
        const bodyComponent = componentList.find((item) => item.type === "BODY");
        const bodyText = typeof bodyComponent?.text === "string" ? bodyComponent.text : "";
        const indexes = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
        const requiredParameters = indexes.length ? Math.max(...indexes) : 0;
        if (templateParameters.length !== requiredParameters || templateParameters.some((value) => typeof value !== "string" || value.length > 1024)) {
          return fail("template_parameter_mismatch", "Template parameters must match the approved body placeholders.");
        }
      }
      const messageBody = input.payload_type === "template" ? "Template: " + input.template_name : input.body!.trim();
      const idempotencyKey = "agent:" + context.agent_id + ":" + context.turn_id + ":" + input.to;
      const correlationId = context.correlation_id;
      // Atomic retry authorization: an idempotency key may only identify the
      // SAME still-pending, unexpired human review, owned by this actor/agent
      // and containing identical account, recipient, template and message.
      // Never fetch a terminal/foreign action by key after a DO NOTHING race.
      const inserted = await query<{ id: string; status: string }>(
        `INSERT INTO whatsapp_send_actions
           (organization_id, whatsapp_account_id, agent_id, agent_binding_required, requested_by,
            recipient_phone, message_body, payload_type, template_name, template_language,
            template_parameters, status, idempotency_key, correlation_id)
         VALUES ($1,$2,$3,true,$4,$5,$6,$7,$8,$9,$10::jsonb,'pending',$11,$12)
         ON CONFLICT (organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL
         DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
         WHERE whatsapp_send_actions.status = 'pending'
           AND whatsapp_send_actions.expires_at > now()
           AND whatsapp_send_actions.requested_by IS NOT DISTINCT FROM EXCLUDED.requested_by
           AND whatsapp_send_actions.agent_id IS NOT DISTINCT FROM EXCLUDED.agent_id
           AND whatsapp_send_actions.agent_binding_required IS NOT DISTINCT FROM EXCLUDED.agent_binding_required
           AND whatsapp_send_actions.whatsapp_account_id IS NOT DISTINCT FROM EXCLUDED.whatsapp_account_id
           AND whatsapp_send_actions.recipient_phone IS NOT DISTINCT FROM EXCLUDED.recipient_phone
           AND whatsapp_send_actions.message_body IS NOT DISTINCT FROM EXCLUDED.message_body
           AND whatsapp_send_actions.payload_type IS NOT DISTINCT FROM EXCLUDED.payload_type
           AND whatsapp_send_actions.template_name IS NOT DISTINCT FROM EXCLUDED.template_name
           AND whatsapp_send_actions.template_language IS NOT DISTINCT FROM EXCLUDED.template_language
           AND whatsapp_send_actions.template_parameters IS NOT DISTINCT FROM EXCLUDED.template_parameters
         RETURNING id,status`,
        [context.organization_id, accountId, context.agent_id, context.user_id,
          input.to, messageBody, input.payload_type,
          input.payload_type === "template" ? input.template_name : null,
          input.payload_type === "template" ? input.template_language : null,
          JSON.stringify(input.payload_type === "template" ? templateParameters : []),
          idempotencyKey, correlationId],
      );
      const action = inserted.rows[0];
      if (!action) {
        // PostgreSQL's atomic ON CONFLICT predicate returned zero rows: the key
        // belongs to a different requester/payload, or the existing action is no
        // longer 'pending'. Identical agent retries after a blocked/terminal
        // outcome land here too — give the model an accurate, non-retryable
        // explanation instead of a generic conflict it will keep retrying.
        const existing = await query<{ status: string }>(
          "SELECT status FROM whatsapp_send_actions WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1",
          [context.organization_id, idempotencyKey],
        );
        const existingStatus = existing.rows[0]?.status;
        if (existingStatus === "requires_template") {
          return fail("idempotency_conflict",
            "An identical WhatsApp send request was already created but could not be queued: no inbound customer message was received in the last 24 hours (Meta's 24-hour customer-service window). Do not retry the same free-form message. State in your report that WhatsApp delivery is blocked, or retry with an approved template payload.");
        }
        return fail("idempotency_conflict",
          `This WhatsApp approval key belongs to a different requester/payload or a review that is no longer pending (status: ${existingStatus ?? "unknown"}). No new approval was created.`);
      }
      try {
        await recordAuditEvent({ organizationId: context.organization_id, actorUserId: context.user_id, agentId: context.agent_id, correlationId, eventType: "whatsapp.send_approval.requested", targetType: "whatsapp_send_action", targetId: action.id, action: "request_send", decision: "pending", metadata: { accountId, recipientSuffix: input.to.slice(-4), payloadType: input.payload_type, source: "agent_tool" } });
      } catch(error) {
        console.error('[whatsapp-action] persisted proposal audit needs reconciliation',{actionId:action.id,correlationId,errorType:error instanceof Error?error.name:typeof error});
      }
      // Autonomous-send policy: approve and queue the proposal immediately.
      // Every failure is reported with its own code; nothing is silently sent.
      const autoApproval = await autoApproveWhatsAppSendAction({
        organizationId: context.organization_id,
        agentId: context.agent_id,
        accountId,
        actionId: String(action.id),
        requestedBy: context.user_id ?? null,
        recipientPhone: input.to,
        messageBody,
        payloadType: input.payload_type,
        templateName: input.payload_type === "template" ? input.template_name ?? null : null,
        templateLanguage: input.payload_type === "template" ? input.template_language ?? null : null,
        templateParameters,
        idempotencyKey,
        correlationId: correlationId ?? null,
        requireHumanApproval:context.require_human_approval,
      });
      if (autoApproval.kind === "failed") {
        return fail(autoApproval.code, autoApproval.message);
      }
      if (autoApproval.kind === "queued") {
        try {
          await recordAuditEvent({ organizationId: context.organization_id, actorUserId: context.user_id, agentId: context.agent_id, correlationId, eventType: "whatsapp.send_approval.auto_approved", targetType: "whatsapp_send_action", targetId: String(action.id), action: "approve", decision: "allowed", metadata: { accountId, recipientSuffix: input.to.slice(-4), payloadType: input.payload_type, source: "agent_policy_autonomous_send", messageId: autoApproval.messageId } });
        } catch(error) {
          console.error('[whatsapp-action] auto-approval audit needs reconciliation',{actionId:String(action.id),correlationId,errorType:error instanceof Error?error.name:typeof error});
        }
        return {
          ok: true, output: { approval_required: false, auto_approved: true, action_id: String(action.id), status: "queued", message_id: autoApproval.messageId ?? undefined, message: "Auto-approved and queued for delivery by this agent's autonomous-send policy." },
          audit: { tool_name: "whatsapp.send", input_summary: "whatsapp.send approval proposal", output_summary: "auto-approved and queued", duration_ms: Math.max(0, Date.now() - startedAt) },
        };
      }
      return {
        ok: true, output: { approval_required: true, action_id: String(action.id), status: String(action.status) },
        audit: { tool_name: "whatsapp.send", input_summary: "whatsapp.send approval proposal", output_summary: "approval pending", duration_ms: Math.max(0, Date.now() - startedAt) },
      };
    },
  };
}

export interface WhatsAppToolRuntime { registry: ToolRegistry; authorize: (tool: Tool, input: unknown, context: ToolContext) => Promise<ToolAuthorizationDecision>; writeAudit: ToolAuditWriter; }

async function resolveWhatsAppSendAccount(organizationId:string,agentId:string,identifier?:string):Promise<{accountId:string;code?:never;message?:never}|{accountId:null;code:string;message:string}>{
  const label=identifier?.trim() || null;
  const accounts=await query<{id:string}>(`SELECT w.id FROM whatsapp_accounts w
    JOIN agent_whatsapp_accounts b ON b.whatsapp_account_id=w.id AND b.agent_id=$2
    JOIN agents a ON a.id=b.agent_id AND a.organization_id=$1
    WHERE w.organization_id=$1 AND w.status='connected' AND w.deleted_at IS NULL
      AND ($3::text IS NULL OR w.id::text=$3 OR lower(w.display_name)=lower($3) OR w.phone_number=$3)
    ORDER BY w.id LIMIT 2`,[organizationId,agentId,label]);
  if(accounts.rows.length===1)return {accountId:String(accounts.rows[0]!.id)};
  return accounts.rows.length?{accountId:null,code:'account_selection_required',message:'Choose the visible label or phone number of one connected WhatsApp account assigned to this agent.'}
    :{accountId:null,code:'account_not_bound',message:'Bind a connected WhatsApp account to this agent in Channels before requesting a send.'};
}

/** Missing policy and revoked allowlist entries fail closed. whatsapp.send only creates a pending approval; provider delivery remains worker-only after a human decision. */
export async function createWhatsAppToolRuntime(organizationId: string, agentId: string): Promise<WhatsAppToolRuntime> {
  const agents = new PostgresAgentRepository();
  const policy = await agents.policy(organizationId, agentId);
  const allowedTools = policy?.allowedTools ?? [];
  const registry = new ToolRegistry((requestedAgentId) => requestedAgentId === agentId ? allowedTools : null);
  registry.register(createWhatsAppHistoryTool() as unknown as Tool);
  registry.register(createWhatsAppSendApprovalTool() as unknown as Tool);
  const authorize: WhatsAppToolRuntime["authorize"] = async (tool, input, context) => {
    if (context.organization_id !== organizationId || context.agent_id !== agentId) return { allowed: false, code: "context_mismatch", message: "The tool context does not match the initialized agent runtime." };
    const currentPolicy = await agents.policy(organizationId, agentId);
    if (!currentPolicy?.allowedTools.includes(tool.name)) return { allowed: false, code: "tool_not_allowed", message: "This tool is not enabled for the current agent." };
    if (tool.sensitivity !== "safe" && tool.name !== "whatsapp.send") return { allowed: false, code: "approval_required", message: "This sensitive operation has no registered approval workflow." };
    if (tool.name === "whatsapp.send") {
      if (!context.auth_subject.permissions.includes("whatsapp.send")) return { allowed: false, code: "permission_denied", message: "The current actor cannot request WhatsApp sends." };
      const inputValue = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
      const accountId = typeof inputValue.account_id === "string" ? inputValue.account_id : "";
      const selection=await resolveWhatsAppSendAccount(organizationId,agentId,accountId);
      if(selection.accountId === null)return {allowed:false,code:selection.code,message:selection.message};
    }
    return { allowed: true };
  };
  const writeAudit: ToolAuditWriter = async (toolName, tool, context, outcome) => {
    await recordAuditEvent({ organizationId: context.organization_id, actorUserId: context.user_id, agentId: context.agent_id, eventType: "agent.tool_call", targetType: tool?.domain ?? "tool", action: toolName, decision: outcome.ok ? "allow" : (outcome.error?.code ?? "deny"), correlationId: context.correlation_id, metadata: { channel: context.channel, tool_name: toolName, success: outcome.ok, error_code: outcome.error?.code ?? null, duration_ms: outcome.audit.duration_ms } });
  };
  return { registry, authorize, writeAudit };
}

export async function invokeWhatsAppTool(runtime: WhatsAppToolRuntime, toolName: string, input: unknown, context: ToolContext) { return executeRegisteredTool(runtime.registry, toolName, input, context, runtime.authorize, runtime.writeAudit); }
