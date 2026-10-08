import {
  completeEmailAction,
  getEmailActionForOrganization,
  PostgresEmailAccountRepository,
  parseCredentialsMasterKey,
  claimApprovedEmailAction,
  getMailMessageForOrganization,
  markLocalDraftSentForOrganization,
} from "@ai-comms-agent/db";
import type { DraftParams, EmailCredentials } from "@ai-comms-agent/shared";
import { createEmailProviderRegistry } from "./registry";
import { verifyEmailProviderConnection } from "./provider-verification";

function credentialsFor(
  encrypted: Record<string, unknown>,
  config: Record<string, unknown>,
): EmailCredentials {
  return {
    ...(encrypted as unknown as EmailCredentials),
    ...(config as unknown as Partial<EmailCredentials>),
  };
}

/**
 * Execute exactly one approved action. This is intentionally worker-only:
 * browser/API code can request and approve an action but never receives
 * provider credentials or directly invokes the provider.
 */
export async function executeApprovedEmailAction(actionId: string, organizationId: string) {
  const action = await getEmailActionForOrganization(organizationId, actionId);
  if (!action) throw new Error("Email action not found");
  const claimed = await claimApprovedEmailAction(actionId, organizationId);
  if (!claimed) throw new Error("Email action is not approved, expired, or already executing");

  try {
    const masterKey = process.env.CREDENTIALS_MASTER_KEY
      ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY)
      : null;
    if (!masterKey) throw new Error("Credential encryption is not configured");

    const accounts = new PostgresEmailAccountRepository();
    const account = await accounts.getById(claimed.emailAccountId);
    if (!account || account.organization_id !== organizationId) throw new Error("Email account is unavailable");
    const encrypted = await accounts.loadCredentials(account.id, masterKey);
    if (!encrypted) throw new Error("Email account credentials are unavailable");
    const config = await accounts.getConnectionConfig(account.id);
    const credentials = credentialsFor(encrypted, config);
    const provider = createEmailProviderRegistry().create(account.provider);

    const snapshot = claimed.recipientSnapshot;
    const result = await verifyEmailProviderConnection(provider, credentials, async ({ provider: connected }) => {
      if (claimed.actionType === "send_email") {
        const draftId = claimed.draftId;
        if (!draftId) throw new Error("Approved send action has no draft");
        const draft = await getMailMessageForOrganization(organizationId, draftId);
        if (!draft || !Boolean(draft.is_draft)) throw new Error("Approved draft is no longer available");
        const params: DraftParams = {
          to: Array.isArray(snapshot.to) ? snapshot.to.map(String) : [],
          cc: Array.isArray(snapshot.cc) ? snapshot.cc.map(String) : [],
          bcc: Array.isArray(snapshot.bcc) ? snapshot.bcc.map(String) : [],
          subject: String(snapshot.subject ?? ""),
          body_text: String(snapshot.bodyText ?? ""),
        };
        const providerDraftId = draft.provider_draft_id
          ? String(draft.provider_draft_id)
          : (await connected.createDraft(params)).draft_id;
        const sent = await connected.sendDraft(providerDraftId);
        await markLocalDraftSentForOrganization(organizationId, draftId, sent.provider_message_id);
        return sent;
      }

      const messageId = String(snapshot.messageId ?? "");
      const source = await getMailMessageForOrganization(organizationId, messageId);
      if (!source?.provider_message_id) throw new Error("Source message has no provider message id");

      if (claimed.actionType === "reply_email") {
        const params: DraftParams = {
          to: Array.isArray(snapshot.to) ? snapshot.to.map(String) : [],
          cc: Array.isArray(snapshot.cc) ? snapshot.cc.map(String) : [],
          bcc: Array.isArray(snapshot.bcc) ? snapshot.bcc.map(String) : [],
          subject: String(snapshot.subject ?? ""),
          body_text: String(snapshot.bodyText ?? ""),
          reply_to_message_id: String(source.provider_message_id),
        };
        return connected.reply(String(source.provider_message_id), params);
      }

      const recipients = Array.isArray(snapshot.to) ? snapshot.to.map(String) : [];
      return connected.forward(String(source.provider_message_id), recipients);
    });

    const completed = await completeEmailAction(claimed.id, "completed", {
      provider: account.provider,
      result: result.value ?? null,
    });
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email action failed";
    await completeEmailAction(claimed.id, "failed", {}, message);
    throw error;
  }
}
