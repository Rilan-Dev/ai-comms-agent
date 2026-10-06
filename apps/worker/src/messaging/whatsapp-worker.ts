import { loadWhatsAppCredential, listQueuedWhatsAppOutbound, markWhatsAppOutboundFailed, markWhatsAppOutboundSent, PostgresEmailAccountRepository, parseCredentialsMasterKey, recordAuditEvent } from "@ai-comms-agent/db";
import { getWhatsAppAccountForOrganization } from "@ai-comms-agent/db";

const GRAPH_HOST = "https://graph.facebook.com";

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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "Meta WhatsApp API request failed");
      const providerMessageId = typeof payload?.messages?.[0]?.id === "string" ? payload.messages[0].id : "";
      if (!providerMessageId) throw new Error("Meta WhatsApp API returned no message ID");
      await markWhatsAppOutboundSent(String(message.id), providerMessageId);
      await recordAuditEvent({ organizationId: String(message.organization_id), actorUserId: null, eventType: "whatsapp.message.sent", targetType: "whatsapp_message", targetId: String(message.id), action: "send", decision: "allowed", metadata: { providerMessageId } });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "WhatsApp send failed";
      await markWhatsAppOutboundFailed(String(message.id), messageText);
      await recordAuditEvent({ organizationId: String(message.organization_id), actorUserId: null, eventType: "whatsapp.message.failed", targetType: "whatsapp_message", targetId: String(message.id), action: "send", decision: "denied", metadata: { error: messageText } });
    }
  }
  return { processed };
}
