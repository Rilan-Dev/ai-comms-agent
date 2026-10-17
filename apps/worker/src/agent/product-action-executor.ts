import { createEmailAction, getWhatsAppAccountForAgent, PostgresEmailAccountRepository, query, recordAuditEvent } from "@ai-comms-agent/db";
import type { ProductActionResult } from "@ai-comms-agent/shared";

type Action = Record<string, unknown>;
type Context = { organizationId: string; agentId: string; executionId: string; output: string };

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function actionsFromParams(params: Record<string, unknown>): Action[] {
  const raw = params.actions ?? params.action;
  if (Array.isArray(raw)) return raw.filter((value): value is Action => !!value && typeof value === "object" && !Array.isArray(value));
  return raw && typeof raw === "object" && !Array.isArray(raw) ? [raw as Action] : [];
}

export async function executeProductActions(context: Context, params: Record<string, unknown>) {
  const actions = actionsFromParams(params);
  const emailAccounts = new PostgresEmailAccountRepository();
  const results: ProductActionResult[] = [];
  for (const action of actions) {
    const type = stringValue(action.type);

    if (type === "send_whatsapp") {
      const account = await getWhatsAppAccountForAgent(context.organizationId, context.agentId);
      const to = stringValue(action.to);
      if (!account || account.status !== "connected" || !to || !/^\+[1-9]\d{7,14}$/.test(to)) {
        results.push({
          type,
          status: "configuration_required",
          reason: !account ? "No WhatsApp account is bound to the agent" : account.status !== "connected" ? "WhatsApp account is not connected" : "A valid E.164 WhatsApp recipient is required",
        });
        continue;
      }
      const template = stringValue(action.body);
      const body = (template ? template.replaceAll("{{output}}", context.output) : context.output).trim();
      if (!body || body.length > 4096) {
        results.push({ type, status: "configuration_required", reason: "Generated WhatsApp text must contain 1–4096 characters" });
        continue;
      }
      const idempotencyKey = "agent:" + context.agentId + ":execution:" + context.executionId + ":whatsapp:" + to;
      const correlationId = context.executionId;
      const inserted = await query<{ id: string; status: string }>(
        "INSERT INTO whatsapp_send_actions (organization_id, whatsapp_account_id, agent_id, agent_binding_required, requested_by, recipient_phone, message_body, payload_type, status, idempotency_key, correlation_id) VALUES ($1,$2,$3,true,NULL,$4,$5,'text','pending',$6,$7) ON CONFLICT (organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING id,status",
        [context.organizationId, account.id, context.agentId, to, body, idempotencyKey, correlationId],
      );
      let approval: { id: string; status: string; whatsapp_account_id?: string; recipient_phone?: string; message_body?: string } | undefined = inserted.rows[0];
      if (!approval) {
        const existing = await query<{ id: string; status: string; whatsapp_account_id: string; recipient_phone: string; message_body: string }>(
          "SELECT id,status,whatsapp_account_id,recipient_phone,message_body FROM whatsapp_send_actions WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1",
          [context.organizationId, idempotencyKey],
        );
        approval = existing.rows[0];
        if (!approval || String(approval.whatsapp_account_id) !== account.id || String(approval.recipient_phone) !== to || String(approval.message_body) !== body) {
          results.push({ type, status: "failed", reason: "WhatsApp approval idempotency conflict" });
          continue;
        }
      }
      await recordAuditEvent({ organizationId: context.organizationId, actorUserId: null, agentId: context.agentId, eventType: "whatsapp.send_approval.requested", targetType: "whatsapp_send_action", targetId: approval.id, action: "send_whatsapp", decision: "pending_approval", correlationId, metadata: { executionId: context.executionId, recipientSuffix: to.slice(-4), accountId: account.id } });
      results.push({ type, status: "pending_approval", actionId: String(approval.id), reason: "Human approval is required; no WhatsApp message has been queued or sent." });
      continue;
    }

    if (type === "create_email_approval") {
      const emailAccountId = stringValue(action.emailAccountId);
      const actionType = stringValue(action.actionType) as "send_email" | "reply_email" | "forward_email" | null;
      if (!emailAccountId || !actionType || !["send_email", "reply_email", "forward_email"].includes(actionType)) {
        results.push({ type, status: "configuration_required", reason: "Email account and supported actionType are required" });
        continue;
      }
      const boundAccount = await emailAccounts.getForAgent(context.organizationId, context.agentId, emailAccountId);
      if (!boundAccount) {
        results.push({ type, status: "configuration_required", reason: "Email account is not owned by the organization or bound to this agent" });
        continue;
      }
      const recipientSnapshot = action.recipientSnapshot && typeof action.recipientSnapshot === "object" && !Array.isArray(action.recipientSnapshot)
        ? action.recipientSnapshot as Record<string, unknown>
        : { body: context.output };
      const approval = await createEmailAction({
        organizationId: context.organizationId,
        agentId: context.agentId,
        emailAccountId,
        actionType,
        draftId: stringValue(action.draftId),
        recipientSnapshot: { ...recipientSnapshot, generatedOutput: context.output },
        requestedBy: null,
        correlationId: context.executionId,
      });
      await recordAuditEvent({ organizationId: context.organizationId, actorUserId: null, agentId: context.agentId, eventType: "email.action.requested", targetType: "email_action", targetId: approval.id, action: actionType, decision: "pending_approval", correlationId: context.executionId, metadata: { executionId: context.executionId, emailAccountId } });
      results.push({ type, status: "pending_approval", actionId: approval.id });
      continue;
    }

    results.push({ type: type ?? "unknown", status: "unsupported", reason: "Action type is not enabled by the host runtime" });
  }
  return results;
}
