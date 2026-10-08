import { loadWhatsAppCredential, listQueuedWhatsAppOutbound, markWhatsAppOutboundFailed, markWhatsAppOutboundSent, parseCredentialsMasterKey, recordAuditEvent } from "@ai-comms-agent/db";
import { getWhatsAppAccountForOrganization, listPendingWhatsAppAccounts, updateWhatsAppAccountStatus } from "@ai-comms-agent/db";
import { emitProviderEvent } from "../events/provider-events";

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
      await updateWhatsAppAccountStatus(account.organization_id, account.id, "connected", null, typeof payload?.display_phone_number === "string" ? payload.display_phone_number : null, typeof payload?.verified_name === "string" ? payload.verified_name : null);
      await recordAuditEvent({ organizationId: account.organization_id, actorUserId: null, eventType: "whatsapp.account.verified", targetType: "whatsapp_account", targetId: account.id, action: "verify", decision: "allowed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "WhatsApp verification failed";
      await updateWhatsAppAccountStatus(String(row.organization_id), String(row.id), "error", message);
      await recordAuditEvent({ organizationId: String(row.organization_id), actorUserId: null, eventType: "whatsapp.account.verification_failed", targetType: "whatsapp_account", targetId: String(row.id), action: "verify", decision: "denied", metadata: { error: message } });
    }
  }
  return { processed };
}

export async function processQueuedWhatsAppMessages(limit = 10) {
  if (!process.env.DATABASE_URL) return { processed: 0 };
  const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
  if (!masterKey) return { processed: 0 };
  let processed = 0;
  const messages = await listQueuedWhatsAppOutbound(limit);
  for (const message of messages) {
    processed += 1;
    try {
      const account = await getWhatsAppAccountForOrganization(String(message.organization_id), String(message.whatsapp_account_id));
      if (!account) throw new Error("WhatsApp account is unavailable");
      const credential = await loadWhatsAppCredential(account.id, account.organization_id, masterKey);
      const token = typeof credential?.access_token === "string" ? credential.access_token : "";
      if (!token) throw new Error("WhatsApp access token is unavailable");
      const version = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
      const url = new URL(version + "/" + encodeURIComponent(account.phone_number_id) + "/messages", GRAPH_HOST + "/");
      const response = await fetch(url, {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: String(message.phone_number), type: "text", text: { body: String(message.body ?? "") } }),
      });
      const payload = (await response.json().catch(() => ({}))) as WhatsAppGraphPayload;
      if (!response.ok) throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "Meta WhatsApp API request failed");
      const providerMessageId = typeof payload?.messages?.[0]?.id === "string" ? payload.messages[0].id : "";
      if (!providerMessageId) throw new Error("Meta WhatsApp API returned no message ID");
      await markWhatsAppOutboundSent(String(message.id), providerMessageId);
      await emitProviderEvent({ type: "whatsapp.message.sent", organizationId: String(message.organization_id), messageId: String(message.id), accountId: String(message.whatsapp_account_id), correlationId: message.correlation_id ? String(message.correlation_id) : null, metadata: { providerMessageId } });
      await recordAuditEvent({ organizationId: String(message.organization_id), actorUserId: null, eventType: "whatsapp.message.sent", targetType: "whatsapp_message", targetId: String(message.id), action: "send", decision: "allowed", correlationId: message.correlation_id ? String(message.correlation_id) : null, metadata: { providerMessageId } });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "WhatsApp send failed";
      await markWhatsAppOutboundFailed(String(message.id), messageText);
      await emitProviderEvent({ type: "whatsapp.message.failed", organizationId: String(message.organization_id), messageId: String(message.id), accountId: String(message.whatsapp_account_id), correlationId: message.correlation_id ? String(message.correlation_id) : null, metadata: { error: messageText } });
      await recordAuditEvent({ organizationId: String(message.organization_id), actorUserId: null, eventType: "whatsapp.message.failed", targetType: "whatsapp_message", targetId: String(message.id), action: "send", decision: "denied", correlationId: message.correlation_id ? String(message.correlation_id) : null, metadata: { error: messageText } });
    }
  }
  return { processed };
}
