import {
  claimQueuedProviderDraftSyncForOrganization,
  markDraftProviderSyncedForOrganization,
  markDraftProviderSyncErrorForOrganization,
  PostgresEmailAccountRepository,
  parseCredentialsMasterKey,
  recordAuditEvent,
} from "@ai-comms-agent/db";
import type { DraftParams, EmailCredentials } from "@ai-comms-agent/shared";
import {emailReplyMetadata} from "@ai-comms-agent/shared";
import { CapabilityNotSupported } from "@ai-comms-agent/shared";
import { createEmailProviderRegistry } from "./registry";
import { verifyEmailProviderConnection } from "./provider-verification";

/**
 * Explicit draft saving queues safe provider syncing. The DB converts queued to
 * syncing and issues a unique lease before any provider credentials are used.
 * An edit, delete, or newer request invalidates this lease; a late worker must
 * never stamp an outdated provider draft as the latest local draft.
 */
export async function syncLocalDraftToProvider(organizationId: string, messageId: string) {
  const draft = await claimQueuedProviderDraftSyncForOrganization(organizationId, messageId);
  if (!draft) return { messageId, skipped: true as const };
  const lease = String(draft.provider_draft_sync_token ?? "");
  if (!lease) throw new Error("Claimed provider draft synchronization lacks an attempt token");

  const accountId = String(draft.email_account_id);
  let providerName = "";
  try {
    const repository = new PostgresEmailAccountRepository();
    const account = await repository.getById(accountId);
    if (!account || account.organization_id !== organizationId || account.status !== "connected") {
      throw new Error("Email account is unavailable or disconnected");
    }
    if (!account.capabilities.drafts) throw new CapabilityNotSupported(account.provider, "drafts");
    providerName = account.provider;

    const masterKey = process.env.CREDENTIALS_MASTER_KEY
      ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY)
      : null;
    if (!masterKey) throw new Error("Credential encryption is not configured");
    const encrypted = await repository.loadCredentials(accountId, masterKey);
    if (!encrypted) throw new Error("Email account credentials are unavailable");
    const config = await repository.getConnectionConfig(accountId);
    const credentials: EmailCredentials = {
      ...(encrypted as unknown as EmailCredentials),
      ...(config as unknown as Partial<EmailCredentials>),
    };

    const provider = createEmailProviderRegistry().create(account.provider);
    const result = await verifyEmailProviderConnection(provider, credentials, async ({ provider: connected }) => {
      const reply=emailReplyMetadata(draft);
      const params: DraftParams = {
        ...(reply.inReplyTo?{reply_to_message_id:reply.inReplyTo,references_header:reply.referencesHeader,provider_thread_id:reply.providerThreadId}:{}),
        to: Array.isArray(draft.to_recipients) ? draft.to_recipients.map(String) : [],
        cc: Array.isArray(draft.cc_recipients) ? draft.cc_recipients.map(String) : [],
        bcc: Array.isArray(draft.bcc_recipients) ? draft.bcc_recipients.map(String) : [],
        subject: String(draft.subject ?? ""),
        body_text: String(draft.text_body ?? ""),
      };
      const remote = draft.provider_draft_id
        ? await connected.updateDraft(String(draft.provider_draft_id), params)
        : await connected.createDraft(params);
      return remote.draft_id;
    });
    const providerDraftId = String(result.value);
    if (!providerDraftId || providerDraftId === "undefined" || providerDraftId === "null") {
      throw new Error("Provider did not confirm the synchronized draft identity");
    }
    const settled = await markDraftProviderSyncedForOrganization(organizationId, messageId, providerDraftId, lease);
    if (!settled) {
      // An edit or newer lease won while the provider call was in flight.
      // The remote copy may need a new explicit sync, but the edited local
      // content must never be marked synchronized to the old provider copy.
      return { messageId, skipped: true as const, reason: "draft_changed" };
    }
    try {
      await recordAuditEvent({ organizationId, actorUserId: null, eventType: "email.draft.provider_synced",
        targetType: "email_message", targetId: messageId, action: "sync", decision: "allowed",
        metadata: { provider: providerName, providerDraftId } });
    } catch (auditError) {
      // A secondary audit outage after durable sync is NOT a provider failure.
      console.error("[draft-sync] evidence write failed after confirmed sync", {
        messageId, errorType: auditError instanceof Error ? auditError.name : typeof auditError,
      });
    }
    return { messageId, providerDraftId, provider: providerName };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider draft synchronization failed";
    let marked = null;
    try {
      marked = await markDraftProviderSyncErrorForOrganization(organizationId, messageId, message, lease);
    } catch (settlementError) {
      console.error("[draft-sync] could not settle provider draft attempt", {
        messageId, errorType: settlementError instanceof Error ? settlementError.name : typeof settlementError,
      });
    }
    if (marked) {
      try {
        await recordAuditEvent({ organizationId, actorUserId: null, eventType: "email.draft.provider_sync_failed",
          targetType: "email_message", targetId: messageId, action: "sync", decision: "denied",
          metadata: { provider: providerName, error: message } });
      } catch (auditError) {
        console.error("[draft-sync] failure evidence write failed", {
          messageId, errorType: auditError instanceof Error ? auditError.name : typeof auditError,
        });
      }
    }
    throw error;
  }
}
