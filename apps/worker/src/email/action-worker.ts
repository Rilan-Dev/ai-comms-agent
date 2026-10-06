import {
  claimApprovedEmailAction,
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

export async function processApprovedEmailActions(limit = 10) {
  if (!process.env.DATABASE_URL) return { processed: 0 };
  let processed = 0;
  const actions = await listApprovedEmailActions(limit);
  for (const candidate of actions) {
    const action = await claimApprovedEmailAction(candidate.id);
    if (!action) continue;
    processed += 1;
    try {
      const repository = new PostgresEmailAccountRepository();
      const account = await repository.getById(action.emailAccountId);
      if (!account || account.organization_id !== action.organizationId) throw new Error("Email account is unavailable");
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
            ? String(draft.provider_draft_id)
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
      const value = result.value as { kind: string; ref: { message_id: string; provider_message_id: string } };
      if (action.actionType === "send_email" && action.draftId) await markLocalDraftSentForOrganization(action.organizationId, action.draftId, value.ref.provider_message_id);
      await completeEmailAction(action.id, "completed", { provider: account.provider, kind: value.kind, providerMessageId: value.ref.provider_message_id });
      await recordAuditEvent({ organizationId: action.organizationId, actorUserId: action.approvedBy, eventType: "email.action.completed", targetType: "email_action", targetId: action.id, action: action.actionType, decision: "allowed", metadata: { provider: account.provider, providerMessageId: value.ref.provider_message_id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider execution failed";
      await completeEmailAction(action.id, "failed", {}, message);
      await recordAuditEvent({ organizationId: action.organizationId, actorUserId: action.approvedBy, eventType: "email.action.failed", targetType: "email_action", targetId: action.id, action: action.actionType, decision: "denied", metadata: { error: message } });
    }
  }
  return { processed };
}
