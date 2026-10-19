import { recordAuditEvent } from "@ai-comms-agent/db";
import { evaluateAutomationEvent } from "../automation/automation-engine";

export type ProviderEvent =
  | {
      type: "email.action.completed" | "email.action.failed";
      organizationId: string;
      actionId: string;
      actionType: string;
      emailAccountId: string;
      correlationId?: string | null;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "whatsapp.message.sent" | "whatsapp.message.failed" | "whatsapp.message.delivered" | "whatsapp.message.read";
      organizationId: string;
      messageId: string;
      accountId: string;
      correlationId?: string | null;
      metadata?: Record<string, unknown>;
    };

/**
 * Worker-owned bridge from provider outcomes into host automation.
 * Provider callbacks never execute agent work inside a web request.
 */
export function providerEventToAutomationEvent(event: ProviderEvent) {
  return {
    type: event.type,
    // Trusted provider event envelope, never caller-controlled metadata.
    organizationId: event.organizationId,
    payload: {
      ...event.metadata,
      // Canonical routing/identity fields must win over provider metadata.
      // Provider metadata is informational and cannot retarget an event across
      // organizations, actions, messages, accounts, or correlations.
      organizationId: event.organizationId,
      actionId: "actionId" in event ? event.actionId : undefined,
      messageId: "messageId" in event ? event.messageId : event.metadata?.messageId,
      accountId: "accountId" in event ? event.accountId : undefined,
      emailAccountId: "emailAccountId" in event ? event.emailAccountId : undefined,
      correlationId: event.correlationId ?? undefined,
    },
  };
}

export async function emitProviderEventWith(
  event: ProviderEvent,
  evaluator: (mapped: ReturnType<typeof providerEventToAutomationEvent>) => Promise<unknown>,
) {
  try {
    return {
      deliveredToAutomation: true,
      result: await evaluator(providerEventToAutomationEvent(event)),
    };
  } catch (error) {
    // Provider delivery state is authoritative. Automation is downstream and
    // must never turn a successful external side effect into a false failure.
    const message = error instanceof Error ? error.message : "Automation event delivery failed";
    try {
      await recordAuditEvent({
        organizationId: event.organizationId,
        actorUserId: null,
        eventType: "automation.provider_event_delivery_failed",
        targetType: "provider_event",
        targetId: "actionId" in event ? event.actionId : event.messageId,
        action: event.type,
        decision: "denied",
        correlationId: event.correlationId ?? null,
        metadata: { error: message, providerEventType: event.type },
      });
    } catch {
      // Audit persistence is best-effort here; never rethrow into the
      // provider outcome path after an external side effect.
    }
    return {
      deliveredToAutomation: false,
      result: null,
      error: message,
    };
  }
}

export async function emitProviderEvent(event: ProviderEvent) {
  return emitProviderEventWith(event, evaluateAutomationEvent);
}
