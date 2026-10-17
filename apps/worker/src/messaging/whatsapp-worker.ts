import { loadWhatsAppCredential, claimQueuedWhatsAppOutbound, recoverStaleWhatsAppOutbound, markWhatsAppOutboundFailed, markWhatsAppOutboundSent, parseCredentialsMasterKey, query, recordAuditEvent } from "@ai-comms-agent/db";
import { getWhatsAppAccountForOrganization, listPendingWhatsAppAccounts, updateWhatsAppAccountStatus } from "@ai-comms-agent/db";
import { emitProviderEvent } from "../events/provider-events";
import { isRetryableProviderError } from "../email/retry";

const GRAPH_HOST = "https://graph.facebook.com";

type WhatsAppGraphPayload = {
  error?: { message?: unknown };
  display_phone_number?: unknown;
  verified_name?: unknown;
  messages?: Array<{ id?: unknown }>;
};

export async function verifyPendingWhatsAppAccounts(limit = 10) {
  if (!process.env.DATABASE_URL) return { processed: 0 };
  const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
  if (!masterKey) return { processed: 0 };
  let processed = 0;
  for (const row of await listPendingWhatsAppAccounts(limit)) {
    processed += 1;
    let retryAttempts = 1;
    try {
      const account = await getWhatsAppAccountForOrganization(String(row.organization_id), String(row.id));
      if (!account) continue;
      const credential = await loadWhatsAppCredential(account.id, account.organization_id, masterKey);
      const token = typeof credential?.access_token === "string" ? credential.access_token : "";
      if (!token) throw new Error("WhatsApp access token is unavailable");
      const version = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
      const url = new URL(version + "/" + encodeURIComponent(account.phone_number_id) + "?fields=display_phone_number,verified_name", GRAPH_HOST + "/");
      const response = await fetch(url, { headers: { authorization: "Bearer " + token } });
      const payload = (await response.json().catch(() => ({}))) as WhatsAppGraphPayload;
      if (!response.ok) throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "Meta WhatsApp account verification failed");
      await updateWhatsAppAccountStatus(account.organization_id, account.id, "connected", null, typeof payload?.display_phone_number === "string" ? payload.display_phone_number : null, account.display_name ?? (typeof payload?.verified_name === "string" ? payload.verified_name : null));
      await recordAuditEvent({ organizationId: account.organization_id, actorUserId: null, eventType: "whatsapp.account.verified", targetType: "whatsapp_account", targetId: account.id, action: "verify", decision: "allowed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "WhatsApp verification failed";
      await updateWhatsAppAccountStatus(String(row.organization_id), String(row.id), "error", message);
      await recordAuditEvent({ organizationId: String(row.organization_id), actorUserId: null, eventType: "whatsapp.account.verification_failed", targetType: "whatsapp_account", targetId: String(row.id), action: "verify", decision: "denied", metadata: { error: message } });
    }
  }
  return { processed };
}

function buildWhatsAppOutboundPayload(message: Record<string, any>) {
  const to = String(message.phone_number ?? "");
  if (message.message_type !== "template") {
    const body = String(message.body ?? "");
    if (!body.trim() || body.length > 4096) throw new Error("WhatsApp text body is empty or exceeds the supported limit");
    return { messaging_product: "whatsapp", to, type: "text", text: { body } };
  }

  const media = message.media && typeof message.media === "object" && !Array.isArray(message.media) ? message.media : {};
  const template = media.template && typeof media.template === "object" && !Array.isArray(media.template) ? media.template : null;
  const name = typeof template?.name === "string" ? template.name : "";
  const language = typeof template?.language === "string" ? template.language : "";
  const parameters = Array.isArray(template?.parameters) ? template.parameters : [];
  if (!/^[a-z0-9_]{1,512}$/.test(name) || !language || parameters.some((value: unknown) => typeof value !== "string" || value.length > 1024)) {
    throw new Error("Approved WhatsApp template payload is invalid");
  }
  const components = parameters.length
    ? [{ type: "body", parameters: parameters.map((text: string) => ({ type: "text", text })) }]
    : undefined;
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name, language: { code: language }, ...(components ? { components } : {}) },
  };
}

export async function processQueuedWhatsAppMessages(limit = 10) {
  if (!process.env.DATABASE_URL) return { processed: 0 };
  const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
  if (!masterKey) return { processed: 0 };
  let processed = 0;
  for (const stale of await recoverStaleWhatsAppOutbound()) {
    await emitProviderEvent({
      type: "whatsapp.message.failed",
      organizationId: stale.organizationId,
      messageId: stale.id,
      accountId: stale.accountId,
      correlationId: stale.correlationId,
      metadata: { providerOutcomeUnknown: true, manualVerificationRequired: true, recoveredStaleExecution: true },
    });
    await recordAuditEvent({
      organizationId: stale.organizationId,
      actorUserId: null,
      eventType: "whatsapp.message.execution_interrupted",
      targetType: "whatsapp_message",
      targetId: stale.id,
      action: "send",
      decision: "denied",
      correlationId: stale.correlationId,
      metadata: { providerOutcomeUnknown: true, manualVerificationRequired: true },
    });
  }
  const messages = await claimQueuedWhatsAppOutbound(limit);
  for (const message of messages) {
    processed += 1;
    const retryAttempts = 1;
    try {
      const account = await getWhatsAppAccountForOrganization(String(message.organization_id), String(message.whatsapp_account_id));
      if (!account) throw new Error("WhatsApp account is unavailable");
      const credential = await loadWhatsAppCredential(account.id, account.organization_id, masterKey);
      const token = typeof credential?.access_token === "string" ? credential.access_token : "";
      if (!token) throw new Error("WhatsApp access token is unavailable");
      const version = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
      if (message.message_type === "template") {
        const media = message.media && typeof message.media === "object" && !Array.isArray(message.media) ? message.media : {};
        const template = media.template && typeof media.template === "object" && !Array.isArray(media.template) ? media.template : null;
        const templateName = typeof template?.name === "string" ? template.name : "";
        const templateLanguage = typeof template?.language === "string" ? template.language : "";
        if (!account.business_account_id || !templateName || !templateLanguage) throw new Error("WhatsApp template payload cannot be verified");
        const templateUrl = new URL(version + "/" + encodeURIComponent(account.business_account_id) + "/message_templates", GRAPH_HOST + "/");
        templateUrl.searchParams.set("name", templateName);
        templateUrl.searchParams.set("fields", "id,name,language,status");
        const templateResponse = await fetch(templateUrl, { headers: { authorization: "Bearer " + token } });
        const templatePayload = await templateResponse.json().catch(() => ({})) as { error?: { message?: unknown }; data?: Array<{ id?: unknown; name?: unknown; language?: unknown; status?: unknown }> };
        const approved = templateResponse.ok && (Array.isArray(templatePayload.data) ? templatePayload.data : []).some((item) => item.name === templateName && item.language === templateLanguage && item.status === "APPROVED");
        if (!approved) throw new Error("WhatsApp template is not currently approved by Meta; outbound was blocked");
      } else {
        const windowCheck = await query<{ id: string }>(
          `SELECT m.id FROM whatsapp_messages m
           JOIN whatsapp_contacts c ON c.id=m.contact_id
           WHERE m.organization_id=$1 AND m.whatsapp_account_id=$2
             AND c.phone_number=$3 AND m.direction='inbound'
             AND COALESCE(m.provider_timestamp,m.created_at) >= now() - interval '24 hours'
           AND COALESCE(m.provider_timestamp,m.created_at) <= now()
           ORDER BY COALESCE(m.provider_timestamp,m.created_at) DESC LIMIT 1`,
          [String(message.organization_id), String(message.whatsapp_account_id), String(message.phone_number)],
        );
        if (!windowCheck.rows.length) throw new Error("WhatsApp free-form text blocked: no inbound customer message within Meta's 24-hour window");
      }
      const url = new URL(version + "/" + encodeURIComponent(account.phone_number_id) + "/messages", GRAPH_HOST + "/");
      const response = await fetch(url, {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify(buildWhatsAppOutboundPayload(message)),
      });
      const payload = (await response.json().catch(() => ({}))) as WhatsAppGraphPayload;
      if (!response.ok) throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "Meta WhatsApp API request failed");
      const providerMessageId = typeof payload?.messages?.[0]?.id === "string" ? payload.messages[0].id : "";
      if (!providerMessageId) throw new Error("Meta WhatsApp API returned no message ID");
      const persistedSent = await markWhatsAppOutboundSent(String(message.id), providerMessageId);
      if (!persistedSent) {
        // A stale-lease recovery may have closed this row while the provider
        // request was in flight. Preserve the confirmed provider ID for manual
        // reconciliation instead of claiming the database transition succeeded.
        await emitProviderEvent({
          type: "whatsapp.message.failed",
          organizationId: String(message.organization_id),
          messageId: String(message.id),
          accountId: String(message.whatsapp_account_id),
          correlationId: message.correlation_id ? String(message.correlation_id) : null,
          metadata: { providerMessageId, providerAccepted: true, persistenceConflict: true, manualVerificationRequired: true },
        });
        await recordAuditEvent({
          organizationId: String(message.organization_id),
          actorUserId: null,
          eventType: "whatsapp.message.persistence_conflict",
          targetType: "whatsapp_message",
          targetId: String(message.id),
          action: "send",
          decision: "denied",
          correlationId: message.correlation_id ? String(message.correlation_id) : null,
          metadata: { providerMessageId, providerAccepted: true, manualVerificationRequired: true },
        });
        continue;
      }
      await query("UPDATE whatsapp_send_actions SET status='sent', updated_at=now() WHERE queued_message_id=$1 AND organization_id=$2 AND status='queued'", [String(message.id), String(message.organization_id)]);
      await emitProviderEvent({ type: "whatsapp.message.sent", organizationId: String(message.organization_id), messageId: String(message.id), accountId: String(message.whatsapp_account_id), correlationId: message.correlation_id ? String(message.correlation_id) : null, metadata: { providerMessageId, retryAttempts } });
      await recordAuditEvent({ organizationId: String(message.organization_id), actorUserId: null, eventType: "whatsapp.message.sent", targetType: "whatsapp_message", targetId: String(message.id), action: "send", decision: "allowed", correlationId: message.correlation_id ? String(message.correlation_id) : null, metadata: { providerMessageId } });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "WhatsApp send failed";
      const retryable = isRetryableProviderError(error);
      if (message.id) {
        const nextActionStatus = messageText.includes("free-form text blocked") || messageText.includes("template is not currently approved")
          ? "requires_template"
          : "failed";
        await query("UPDATE whatsapp_send_actions SET status=$3, updated_at=now() WHERE queued_message_id=$1 AND organization_id=$2 AND status='queued'", [String(message.id), String(message.organization_id), nextActionStatus]);
      }
      await markWhatsAppOutboundFailed(String(message.id), messageText);
      await emitProviderEvent({ type: "whatsapp.message.failed", organizationId: String(message.organization_id), messageId: String(message.id), accountId: String(message.whatsapp_account_id), correlationId: message.correlation_id ? String(message.correlation_id) : null, metadata: { error: messageText, retryAttempts, retryable } });
      await recordAuditEvent({ organizationId: String(message.organization_id), actorUserId: null, eventType: "whatsapp.message.failed", targetType: "whatsapp_message", targetId: String(message.id), action: "send", decision: "denied", correlationId: message.correlation_id ? String(message.correlation_id) : null, metadata: { error: messageText } });
    }
  }
  return { processed };
}
