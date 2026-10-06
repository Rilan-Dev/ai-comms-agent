import { createEmailAction, getWhatsAppAccountForAgent, queueWhatsAppOutboundMessage, PostgresEmailAccountRepository } from "@ai-comms-agent/db";
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
      if (!account || account.status !== "connected" || !to) {
        results.push({
          type,
          status: "configuration_required",
          reason: !account ? "No WhatsApp account is bound to the agent" : account.status !== "connected" ? "WhatsApp account is not connected" : "WhatsApp recipient is missing",
        });
        continue;
      }
      const template = stringValue(action.body);
      const body = template ? template.replaceAll("{{output}}", context.output) : context.output;
      const messageId = await queueWhatsAppOutboundMessage({
        organizationId: context.organizationId,
        accountId: account.id,
        to,
        body,
        idempotencyKey: "agent:" + context.agentId + ":execution:" + context.executionId + ":whatsapp:" + to,
      });
      results.push({ type, status: messageId ? "queued" : "duplicate", messageId: messageId ?? null });
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
      });
      results.push({ type, status: "pending_approval", actionId: approval.id });
      continue;
    }

    results.push({ type: type ?? "unknown", status: "unsupported", reason: "Action type is not enabled by the host runtime" });
  }
  return results;
}
