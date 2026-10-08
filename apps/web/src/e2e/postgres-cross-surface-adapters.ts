import {
  createEmailAction,
  decideEmailAction,
  getEmailActionForOrganization,
  getWhatsAppAccountForOrganization,
  queueWhatsAppOutboundMessage,
  claimDueScheduledJobs,
  listOrganizationAuditEvents,
} from "@ai-comms-agent/db";
import type { CrossSurfaceHarnessStep } from "./cross-surface-harness";

export type PostgresCrossSurfaceFixture = {
  organizationId: string;
  otherOrganizationId: string;
  agentId: string;
  userId: string;
  emailAccountId: string;
  whatsappAccountId: string;
  correlationId: string;
  to: string;
  recipientSnapshot: Record<string, unknown>;
  scheduledJobId?: string;
};

export function createPostgresCrossSurfaceSteps(
  fixture: PostgresCrossSurfaceFixture,
): readonly CrossSurfaceHarnessStep[] {
  let emailActionId: string | null = null;
  let whatsappMessageId: string | null = null;

  return [
    {
      name: "create email approval",
      execute: async (context) => {
        const action = await createEmailAction({
          organizationId: fixture.organizationId,
          agentId: fixture.agentId,
          emailAccountId: fixture.emailAccountId,
          actionType: "send_email",
          recipientSnapshot: fixture.recipientSnapshot,
          requestedBy: fixture.userId,
          idempotencyKey: context.idempotencyKey,
          correlationId: fixture.correlationId,
        });
        emailActionId = action.id;
      },
    },
    {
      name: "retry email approval idempotently",
      execute: async (context) => {
        const action = await createEmailAction({
          organizationId: fixture.organizationId,
          agentId: fixture.agentId,
          emailAccountId: fixture.emailAccountId,
          actionType: "send_email",
          recipientSnapshot: fixture.recipientSnapshot,
          requestedBy: fixture.userId,
          idempotencyKey: context.idempotencyKey,
          correlationId: fixture.correlationId,
        });
        if (!emailActionId || action.id !== emailActionId) {
          throw new Error("Email approval retry created a duplicate action");
        }
      },
    },
    {
      name: "approve email action",
      execute: async () => {
        if (!emailActionId) throw new Error("Email approval was not created");
        const approved = await decideEmailAction(
          fixture.organizationId,
          emailActionId,
          fixture.userId,
          "approved",
        );
        if (!approved || approved.status !== "approved") {
          throw new Error("Email action approval failed");
        }
      },
    },
    {
      name: "queue WhatsApp outbound",
      execute: async (context) => {
        const account = await getWhatsAppAccountForOrganization(
          fixture.organizationId,
          fixture.whatsappAccountId,
        );
        if (!account) throw new Error("WhatsApp account is not available to the organization");
        whatsappMessageId = await queueWhatsAppOutboundMessage({
          organizationId: fixture.organizationId,
          accountId: account.id,
          to: fixture.to,
          body: "Deterministic cross-surface E2E message",
          idempotencyKey: context.idempotencyKey,
          correlationId: fixture.correlationId,
        });
        if (!whatsappMessageId) throw new Error("WhatsApp outbound message was not queued");
      },
    },
    {
      name: "retry WhatsApp outbound idempotently",
      execute: async (context) => {
        const account = await getWhatsAppAccountForOrganization(
          fixture.organizationId,
          fixture.whatsappAccountId,
        );
        if (!account || !whatsappMessageId) throw new Error("WhatsApp fixture is incomplete");
        const retryId = await queueWhatsAppOutboundMessage({
          organizationId: fixture.organizationId,
          accountId: account.id,
          to: fixture.to,
          body: "Deterministic cross-surface E2E message",
          idempotencyKey: context.idempotencyKey,
          correlationId: fixture.correlationId,
        });
        if (retryId !== whatsappMessageId) throw new Error("WhatsApp retry created a duplicate message");
      },
    },
    {
      name: "claim scheduled execution",
      execute: async () => {
        if (!fixture.scheduledJobId) return;
        const claims = await claimDueScheduledJobs(25, new Date().toISOString());
        const claim = claims.find((item) => item.organizationId === fixture.organizationId && item.id === fixture.scheduledJobId);
        if (!claim) throw new Error("Expected scheduled job was not claimable");
      },
    },
    {
      name: "assert organization isolation",
      execute: async () => {
        if (!emailActionId) throw new Error("Email approval was not created");
        const foreignAction = await getEmailActionForOrganization(fixture.otherOrganizationId, emailActionId);
        if (foreignAction) throw new Error("Cross-organization email action was visible");
        const foreignAccount = await getWhatsAppAccountForOrganization(fixture.otherOrganizationId, fixture.whatsappAccountId);
        if (foreignAccount) throw new Error("Cross-organization WhatsApp account was visible");
        const foreignAudit = await listOrganizationAuditEvents(fixture.otherOrganizationId, 100, { correlationId: fixture.correlationId });
        if (foreignAudit.some((event) => event.correlationId === fixture.correlationId)) {
          throw new Error("Cross-organization audit event was visible");
        }
      },
    },
    {
      name: "verify audit correlation",
      execute: async () => {
        const events = await listOrganizationAuditEvents(fixture.organizationId, 100, { correlationId: fixture.correlationId });
        if (!events.some((event) => event.correlationId === fixture.correlationId)) {
          throw new Error("Cross-surface audit correlation was not found");
        }
      },
    },
  ];
}
