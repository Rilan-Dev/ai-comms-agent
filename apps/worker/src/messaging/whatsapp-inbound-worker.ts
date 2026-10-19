import { claimRoutedWhatsAppInbound, completeWhatsAppInbound, recoverStaleWhatsAppInbound, recordAuditEvent } from "@ai-comms-agent/db";
import { dispatchAgentExecution } from "../agent/execution-dispatcher";
import { evaluateAutomationEvent } from "../automation/automation-engine";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function processRoutedWhatsAppInbound(limit = 10) {
  if (!process.env.DATABASE_URL) return { processed: 0, completed: 0, failed: 0 };
  const recovered = await recoverStaleWhatsAppInbound();
  for (const message of recovered) {
    await recordAuditEvent({ organizationId: message.organizationId, actorUserId: null, eventType: "whatsapp.inbound.execution_interrupted", targetType: "whatsapp_message", targetId: message.id, action: "execute", decision: "denied", correlationId: message.correlationId, metadata: { downstreamOutcomeUnknown: true, manualVerificationRequired: true, agentId: message.agentId } });
  }
  const messages = await claimRoutedWhatsAppInbound(limit);
  let completed = 0;
  let failed = 0;

  for (const message of messages) {
    const messageId = String(message.id);
    const organizationId = String(message.organization_id);
    const agentId = text(message.agent_id);
    const accountId = String(message.whatsapp_account_id);
    const contactId = text(message.contact_id);
    const from = text(message.phone_number);
    const body = text(message.body);
    const executionId = text(message.correlation_id) || messageId;

    try {
      if (!agentId || !accountId || !contactId || !from) {
        throw new Error("WhatsApp inbound message is missing an explicit agent/contact routing target");
      }

      if (!body) {
        await completeWhatsAppInbound(messageId, "completed");
        completed += 1;
        continue;
      }

      const result = await dispatchAgentExecution({
        executionId,
        organizationId,
        agentId,
        source: "whatsapp",
        intent: "whatsapp.inbound_command",
        params: {
          messageId,
          accountId,
          contactId,
          sender: from,
          message: body,
          actions: [{ type: "send_whatsapp", to: from, body: "{{output}}" }],
        },
        requestedAt: new Date().toISOString(),
      });

      if (result.status === "configuration_required") {
        throw new Error(result.reason);
      }

      await completeWhatsAppInbound(messageId, "completed");
      await evaluateAutomationEvent({
        type: "whatsapp.received",
        organizationId,
        payload: { messageId, organizationId, agentId, accountId, contactId, sender: from, body },
      });
      await recordAuditEvent({
        organizationId,
        actorUserId: null,
        eventType: "whatsapp.inbound.agent_executed",
        targetType: "whatsapp_message",
        targetId: messageId,
        action: "execute",
        decision: "allowed",
        correlationId: executionId,
        metadata: { executionId, agentId, actionCount: result.actions?.length ?? 0 },
      });
      completed += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "WhatsApp inbound execution failed";
      await completeWhatsAppInbound(messageId, "failed", reason);
      await recordAuditEvent({
        organizationId,
        actorUserId: null,
        eventType: "whatsapp.inbound.agent_execution_failed",
        targetType: "whatsapp_message",
        targetId: messageId,
        action: "execute",
        decision: "denied",
        correlationId: executionId,
        metadata: { agentId, error: reason },
      });
      failed += 1;
    }
  }

  return { processed: messages.length, completed, failed };
}
