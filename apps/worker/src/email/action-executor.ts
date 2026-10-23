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
import { isApprovedEmailActionAccountUsable } from "./action-account-guard";
import { paramsFromApprovedEmailSnapshot } from "./approved-email-draft";
import { assertCurrentEmailActionAuthorization } from "./action-authorization";

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

  let providerAccepted = false;
    let providerDispatchStarted = false;
  try {
    await assertCurrentEmailActionAuthorization(claimed);
    const masterKey = process.env.CREDENTIALS_MASTER_KEY
      ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY)
      : null;
    if (!masterKey) throw new Error("Credential encryption is not configured");

    const accounts = new PostgresEmailAccountRepository();
    const account = await accounts.getById(claimed.emailAccountId);
    if (!isApprovedEmailActionAccountUsable(account, organizationId)) throw new Error("Email account is unavailable");
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
        if (!draft || !Boolean(draft.is_draft) || String(draft.email_account_id) !== claimed.emailAccountId) {
          throw new Error("Approved draft is no longer available in the selected mailbox");
        }
        const params = paramsFromApprovedEmailSnapshot(snapshot);
        // Only dispatch the immutable human-approved snapshot. Remote drafts
        // can have changed since the original review.
        const providerDraftId = (await connected.createDraft(params)).draft_id;
        providerDispatchStarted = true;
        const sent = await connected.sendDraft(providerDraftId);
        providerAccepted = true;
        return sent;
      }

      const messageId = String(snapshot.messageId ?? "");
      const source = messageId ? await getMailMessageForOrganization(organizationId, messageId) : null;
      if (!source || Boolean(source.is_draft)
          || String(source.email_account_id) !== claimed.emailAccountId
          || typeof source.provider_message_id !== "string"
          || !source.provider_message_id.trim() || source.provider_message_id.startsWith("local-draft:")) {
        throw new Error("Approved reply/forward source is not available in the selected mailbox");
      }
      const providerMessageId = String(source.provider_message_id);
      const reviewedParams = paramsFromApprovedEmailSnapshot(snapshot);

      if (claimed.actionType === "reply_email") {
        const params: DraftParams = { ...reviewedParams, reply_to_message_id: providerMessageId };
        providerDispatchStarted = true;
        const replied = await connected.reply(providerMessageId, params);
        providerAccepted = true;
        return replied;
      }

      providerDispatchStarted = true;

      const forwarded = await connected.forward(providerMessageId, reviewedParams.to);
      providerAccepted = true;
      return forwarded;
    });

    const completed = await completeEmailAction(claimed.id, organizationId, "completed", {
      provider: account.provider,
      result: result.value ?? null,
    });
    if (!completed) throw new Error("Provider delivery cannot overwrite a terminal email action");
    // Local draft state is secondary. A failed sync cannot rewrite an accepted
    // provider action as failed or encourage a user to resend it.
    if (claimed.actionType === "send_email" && claimed.draftId && result.value?.provider_message_id) {
      try {
        await markLocalDraftSentForOrganization(organizationId, claimed.draftId, result.value.provider_message_id);
      } catch (reconcileError) {
        console.error("[email-action] local draft reconciliation failed after confirmed delivery", {
          actionId: claimed.id,
          errorType: reconcileError instanceof Error ? reconcileError.name : typeof reconcileError,
        });
      }
    }
    return completed;
  } catch (error) {
    if (providerAccepted || providerDispatchStarted) {
      // A provider call may have succeeded before its disconnect or before
      // the completion DB write failed. Preserve 'executing' for fail-closed
      // stale recovery; do not mark a sent action as failed or requeue it.
      console.error("[email-action] provider outcome requires reconciliation", {
        actionId: claimed.id,
        errorType: error instanceof Error ? error.name : typeof error,
        manualVerificationRequired: true,
      });
      throw error;
    }
    const message = error instanceof Error ? error.message : "Email action failed";
    await completeEmailAction(claimed.id, organizationId, "failed", {}, message);
    throw error;
  }
}
