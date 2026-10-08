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
    payload: {
      organizationId: event.organizationId,
      actionId: "actionId" in event ? event.actionId : undefined,
      messageId: "messageId" in event ? event.messageId : undefined,
      accountId: "accountId" in event ? event.accountId : undefined,
      emailAccountId: "emailAccountId" in event ? event.emailAccountId : undefined,
      correlationId: event.correlationId ?? undefined,
      ...event.metadata,
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
    return {
      deliveredToAutomation: false,
      result: null,
      error: error instanceof Error ? error.message : "Automation event delivery failed",
    };
  }
}

export async function emitProviderEvent(event: ProviderEvent) {
  return emitProviderEventWith(event, evaluateAutomationEvent);
}
