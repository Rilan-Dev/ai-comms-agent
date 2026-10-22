import {
  claimApprovedEmailAction,
  recoverStaleExecutingEmailActions,
  completeEmailAction,
  listApprovedEmailActions,
  getLocalDraftForOrganization,
  markLocalDraftSentForOrganization,
  PostgresEmailAccountRepository,
  parseCredentialsMasterKey,
  recordAuditEvent,
} from "@ai-comms-agent/db";
import type { DraftParams, EmailCredentials } from "@ai-comms-agent/shared";
import { CapabilityNotSupported } from "@ai-comms-agent/shared";
import { createEmailProviderRegistry } from "./registry";
import { verifyEmailProviderConnection } from "./provider-verification";
import { emitProviderEvent } from "../events/provider-events";
import { isRetryableProviderError } from "./retry";

/** Evidence writes and local draft reconciliation are secondary to the
 * durable action terminal state. Log only a type, never provider payloads. */
async function bestEffortEmailOutcome(phase: string, actionId: string, effect: () => Promise<unknown>) {
  try {
    await effect();
  } catch (error) {
    console.error("[email-action] follow-up failed", {
      phase, actionId, errorType: error instanceof Error ? error.name : typeof error,
    });
  }
}

export async function processApprovedEmailActions(limit = 10) {
  if (!process.env.DATABASE_URL) return { processed: 0 };
  let processed = 0;
  const recovered = await recoverStaleExecutingEmailActions();
  for (const action of recovered) {
    await bestEffortEmailOutcome("recovered", action.id, () => recordAuditEvent({ organizationId: action.organizationId, actorUserId: null, eventType: "email.action.execution_interrupted", targetType: "email_action", targetId: action.id, action: action.actionType, decision: "denied", correlationId: action.correlationId, metadata: { providerOutcomeUnknown: true, manualVerificationRequired: true } }));
  }
  const actions = await listApprovedEmailActions(limit);
  for (const candidate of actions) {
    const action = await claimApprovedEmailAction(candidate.id, candidate.organizationId);
    if (!action) continue;
    processed += 1;
    const retryAttempts = 1;
    let providerResult: { kind: string; ref: { message_id: string; provider_message_id: string } } | null = null;
    let accountProvider: string | null = null;
    try {
      const repository = new PostgresEmailAccountRepository();
      const account = await repository.getById(action.emailAccountId);
      if (!account || account.organization_id !== action.organizationId) throw new Error("Email account is unavailable");
      accountProvider = account.provider;
      const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
      if (!masterKey) throw new Error("Credential encryption is not configured");
      const encrypted = await repository.loadCredentials(account.id, masterKey);
      if (!encrypted) throw new Error("Email account credentials are unavailable");
      const config = await repository.getConnectionConfig(account.id);
      const credentials: EmailCredentials = { ...(encrypted as unknown as EmailCredentials), ...(config as unknown as Partial<EmailCredentials>) };
      const provider = createEmailProviderRegistry().create(account.provider);
      const result = await verifyEmailProviderConnection(provider, credentials, async ({ provider: connected }) => {
        const snapshot = action.recipientSnapshot;
        if (action.actionType === "send_email") {
          if (!action.draftId) throw new Error("Approved send action has no draft");
          const draft = await getLocalDraftForOrganization(action.organizationId, action.draftId);
          if (!draft) throw new Error("Approved draft no longer exists");
          if (!account.capabilities.drafts || !account.capabilities.send) throw new CapabilityNotSupported(account.provider, "send");
          const params: DraftParams = {
            to: Array.isArray(snapshot.to) ? snapshot.to.map(String) : [],
            cc: Array.isArray(snapshot.cc) ? snapshot.cc.map(String) : [],
            bcc: Array.isArray(snapshot.bcc) ? snapshot.bcc.map(String) : [],
            subject: String(snapshot.subject ?? draft.subject ?? ""),
            body_text: String(snapshot.bodyText ?? draft.text_body ?? ""),
          };
          const providerDraftId = draft.provider_draft_id
            ? String((await connected.updateDraft(String(draft.provider_draft_id), params)).draft_id)
            : (await connected.createDraft(params)).draft_id;
          return { kind: "send", ref: await connected.sendDraft(providerDraftId) };
        }
        if (action.actionType === "reply_email") {
          if (!account.capabilities.reply) throw new CapabilityNotSupported(account.provider, "reply");
          const messageId = String(snapshot.messageId ?? "");
          if (!messageId) throw new Error("Approved reply action has no source message");
          const params: DraftParams = {
            to: Array.isArray(snapshot.to) ? snapshot.to.map(String) : [],
            cc: Array.isArray(snapshot.cc) ? snapshot.cc.map(String) : [],
            bcc: Array.isArray(snapshot.bcc) ? snapshot.bcc.map(String) : [],
            subject: String(snapshot.subject ?? ""),
            body_text: String(snapshot.bodyText ?? ""),
          };
          return { kind: "reply", ref: await connected.reply(messageId, params) };
        }
        if (!account.capabilities.forward) throw new CapabilityNotSupported(account.provider, "forward");
        const messageId = String(snapshot.messageId ?? "");
        const recipients = Array.isArray(snapshot.to) ? snapshot.to.map(String) : [];
        if (!messageId || recipients.length === 0) throw new Error("Approved forward action is incomplete");
        return { kind: "forward", ref: await connected.forward(messageId, recipients) };
      });
      providerResult = result.value as { kind: string; ref: { message_id: string; provider_message_id: string } };
    } catch (error) {
      // A provider-call error is a failed attempt ONLY if the database agrees
      // this action is still executing. Unknown DB outcome never emits failure.
      const message = error instanceof Error ? error.message : "Provider execution failed";
      const retryable = isRetryableProviderError(error);
      let settled: Awaited<ReturnType<typeof completeEmailAction>>;
      try {
        settled = await completeEmailAction(action.id, action.organizationId, "failed", {}, message);
      } catch (settlementError) {
        console.error("[email-action] could not settle failed execution", {
          actionId: action.id, errorType: settlementError instanceof Error ? settlementError.name : typeof settlementError,
        });
        continue;
      }
      if (!settled) {
        console.error("[email-action] failed execution was already settled", { actionId: action.id });
        continue;
      }
      await bestEffortEmailOutcome("failed_event", action.id, () => emitProviderEvent({
        type: "email.action.failed", organizationId: action.organizationId, actionId: action.id,
        actionType: action.actionType, emailAccountId: action.emailAccountId, correlationId: action.correlationId,
        metadata: { error: message, retryAttempts, retryable },
      }));
      await bestEffortEmailOutcome("failed_audit", action.id, () => recordAuditEvent({
        organizationId: action.organizationId, actorUserId: action.approvedBy,
        eventType: "email.action.failed", targetType: "email_action", targetId: action.id,
        action: action.actionType, decision: "denied", correlationId: action.correlationId,
        metadata: { error: message },
      }));
      continue;
    }

    if (!providerResult || !accountProvider) {
      console.error("[email-action] provider returned no execution result", { actionId: action.id });
      continue;
    }

    // Once the external provider has accepted the action, a local draft-sync,
    // audit or event outage must never falsely relabel the send as failed.
    // If terminal DB completion itself fails, preserve the executing row for
    // fail-closed stale recovery and operator reconciliation, never replay.
    let completed: Awaited<ReturnType<typeof completeEmailAction>>;
    try {
      completed = await completeEmailAction(action.id, action.organizationId, "completed", {
        provider: accountProvider, kind: providerResult.kind,
        providerMessageId: providerResult.ref.provider_message_id, retryAttempts,
      });
    } catch (settlementError) {
      console.error("[email-action] Provider delivery succeeded; durable completion could not be recorded", {
        actionId: action.id, errorType: settlementError instanceof Error ? settlementError.name : typeof settlementError,
        manualVerificationRequired: true,
      });
      continue;
    }
    if (!completed) {
      console.error("[email-action] provider result cannot overwrite an already settled action", { actionId: action.id });
      continue;
    }
    if (action.actionType === "send_email" && action.draftId) {
      await bestEffortEmailOutcome("draft_reconcile", action.id, () =>
        markLocalDraftSentForOrganization(action.organizationId, action.draftId!, providerResult!.ref.provider_message_id));
    }
    await bestEffortEmailOutcome("completed_event", action.id, () => emitProviderEvent({
      type: "email.action.completed", organizationId: action.organizationId, actionId: action.id,
      actionType: action.actionType, emailAccountId: action.emailAccountId, correlationId: action.correlationId,
      metadata: { provider: accountProvider, providerMessageId: providerResult.ref.provider_message_id, retryAttempts },
    }));
    await bestEffortEmailOutcome("completed_audit", action.id, () => recordAuditEvent({
      organizationId: action.organizationId, actorUserId: action.approvedBy,
      eventType: "email.action.completed", targetType: "email_action", targetId: action.id,
      action: action.actionType, decision: "allowed", correlationId: action.correlationId,
      metadata: { provider: accountProvider, providerMessageId: providerResult.ref.provider_message_id },
    }));
  }
  return { processed };
}
