import {
  getLocalDraftForOrganization,
  markDraftProviderSyncingForOrganization,
  markDraftProviderSyncedForOrganization,
  markDraftProviderSyncErrorForOrganization,
  PostgresEmailAccountRepository,
  parseCredentialsMasterKey,
  recordAuditEvent,
} from "@ai-comms-agent/db";
import type { DraftParams, EmailCredentials } from "@ai-comms-agent/shared";
import { CapabilityNotSupported } from "@ai-comms-agent/shared";
import { createEmailProviderRegistry } from "./registry";
import { verifyEmailProviderConnection } from "./provider-verification";

/**
 * Synchronize one persisted local draft to its provider.
 *
 * This is worker-only because provider credentials are decrypted here. The
 * local PostgreSQL draft remains authoritative; provider_draft_id/status are
 * synchronization metadata and never replace the local draft content.
 */
export async function syncLocalDraftToProvider(organizationId: string, messageId: string) {
  const draft = await getLocalDraftForOrganization(organizationId, messageId);
  if (!draft) throw new Error("Draft not found");

  const accountId = String(draft.email_account_id);
  const account = await new PostgresEmailAccountRepository().getById(accountId);
  if (!account || account.organization_id !== organizationId) throw new Error("Email account is unavailable");
  if (!account.capabilities.drafts) throw new CapabilityNotSupported(account.provider, "drafts");

  const masterKey = process.env.CREDENTIALS_MASTER_KEY
    ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY)
    : null;
  if (!masterKey) throw new Error("Credential encryption is not configured");
  const encrypted = await new PostgresEmailAccountRepository().loadCredentials(accountId, masterKey);
  if (!encrypted) throw new Error("Email account credentials are unavailable");
  const config = await new PostgresEmailAccountRepository().getConnectionConfig(accountId);
  const credentials: EmailCredentials = {
    ...(encrypted as unknown as EmailCredentials),
    ...(config as unknown as Partial<EmailCredentials>),
  };

  await markDraftProviderSyncingForOrganization(organizationId, messageId);
  const provider = createEmailProviderRegistry().create(account.provider);
  try {
    const result = await verifyEmailProviderConnection(provider, credentials, async ({ provider: connected }) => {
      const params: DraftParams = {
        to: Array.isArray(draft.to_recipients) ? draft.to_recipients.map(String) : [],
        cc: Array.isArray(draft.cc_recipients) ? draft.cc_recipients.map(String) : [],
        bcc: Array.isArray(draft.bcc_recipients) ? draft.bcc_recipients.map(String) : [],
        subject: String(draft.subject ?? ""),
        body_text: String(draft.text_body ?? ""),
      };
      const providerDraftId = draft.provider_draft_id
        ? (await connected.updateDraft(String(draft.provider_draft_id), params)).draft_id
        : (await connected.createDraft(params)).draft_id;
      return providerDraftId;
    });
    const providerDraftId = String(result.value);
    await markDraftProviderSyncedForOrganization(organizationId, messageId, providerDraftId);
    await recordAuditEvent({ organizationId, actorUserId: null, eventType: "email.draft.provider_synced", targetType: "email_message", targetId: messageId, action: "sync", decision: "allowed", metadata: { provider: account.provider, providerDraftId } });
    return { messageId, providerDraftId, provider: account.provider };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider draft synchronization failed";
    await markDraftProviderSyncErrorForOrganization(organizationId, messageId, message);
    await recordAuditEvent({ organizationId, actorUserId: null, eventType: "email.draft.provider_sync_failed", targetType: "email_message", targetId: messageId, action: "sync", decision: "denied", metadata: { provider: account.provider, error: message } });
    throw error;
  }
}
