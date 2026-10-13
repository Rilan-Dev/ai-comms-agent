import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { applyWhatsAppProviderStatus, getWhatsAppAccountByPhoneNumberId, insertWhatsAppInboundMessage, listAgentsForWhatsAppAccount, recordWhatsAppWebhookEvent, upsertWhatsAppContact } from "@ai-comms-agent/db";

export const dynamic = "force-dynamic";

function signatureValid(raw: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const actual = signature.slice("sha256=".length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  // Distinguish failure modes so the in-app setup guide can tell the user
  // whether they need to set env vars on Vercel vs. fix their Meta App config.
  if (mode !== "subscribe" || !challenge) {
    return new Response("Bad Request — missing hub.mode=subscribe or hub.challenge", { status: 400 });
  }
  if (!process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response("Service Unavailable — WHATSAPP_VERIFY_TOKEN env var is not set on the deployment.", { status: 503 });
  }
  if (token !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response("Unauthorized — verify_token does not match WHATSAPP_VERIFY_TOKEN env var.", { status: 401 });
  }
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureValid(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Forbidden", { status: 403 });
  }
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return new Response("Bad Request", { status: 400 }); }
  const payloadHash = createHash("sha256").update(raw).digest("hex");
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  let accepted = 0;
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      const phoneNumberId = typeof value?.metadata?.phone_number_id === "string" ? value.metadata.phone_number_id : "";
      if (!phoneNumberId) continue;
      const account = await getWhatsAppAccountByPhoneNumberId(phoneNumberId);
      if (!account) continue;
      const providerEventId = typeof entry?.id === "string" && typeof change?.field === "string" ? entry.id + ":" + change.field + ":" + payloadHash.slice(0, 16) : payloadHash;
      const event = await recordWhatsAppWebhookEvent({ organizationId: account.organization_id, accountId: account.id, providerEventId, eventType: String(change?.field ?? "unknown"), payloadHash, payload: value ?? {} });
      if (!event.inserted) continue;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const contactMap = new Map<string, string>(contacts.map((c: any) => [String(c.wa_id ?? ""), String(c.profile?.name ?? "")] as [string, string]));
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
      for (const status of statuses) {
        const providerMessageId = typeof status?.id === "string" ? status.id : "";
        const providerStatus = typeof status?.status === "string" ? status.status : "";
        if (!providerMessageId || !["sent", "delivered", "read", "failed"].includes(providerStatus)) continue;
        const result = await applyWhatsAppProviderStatus({
          organizationId: account.organization_id,
          accountId: account.id,
          providerMessageId,
          status: providerStatus as "sent" | "delivered" | "read" | "failed",
          error: Array.isArray(status?.errors) && status.errors[0] ? String(JSON.stringify(status.errors[0])).slice(0, 2000) : null,
          timestamp: typeof status?.timestamp === "string" ? new Date(Number(status.timestamp) * 1000).toISOString() : null,
        });
        if (result) accepted += 1;
      }

      const messages = Array.isArray(value?.messages) ? value.messages : [];
      const agents = await listAgentsForWhatsAppAccount(account.organization_id, account.id);
      for (const message of messages) {
        const from = typeof message?.from === "string" ? message.from : "";
        const providerMessageId = typeof message?.id === "string" ? message.id : "";
        if (!from || !providerMessageId) continue;
        const contactId = await upsertWhatsAppContact({ organizationId: account.organization_id, accountId: account.id, phoneNumber: from, displayName: contactMap.get(from) || null, providerContactId: from });
        const type = typeof message?.type === "string" ? message.type : "unknown";
        const rawMedia = type === "text" ? {} : message?.[type] ?? {};
        const media = rawMedia && typeof rawMedia === "object" ? {
          id: typeof rawMedia.id === "string" ? rawMedia.id : undefined,
          mime_type: typeof rawMedia.mime_type === "string" ? rawMedia.mime_type : undefined,
          sha256: typeof rawMedia.sha256 === "string" ? rawMedia.sha256 : undefined,
          caption: typeof rawMedia.caption === "string" ? rawMedia.caption.slice(0, 4096) : undefined,
        } : {};
        const body = type === "text" && typeof message?.text?.body === "string" ? message.text.body : (typeof media.caption === "string" ? media.caption : null);
        for (const agent of agents) {
          await insertWhatsAppInboundMessage({
            organizationId: account.organization_id,
            accountId: account.id,
            agentId: agent.id,
            contactId,
            providerMessageId: agents.length === 1 ? providerMessageId : providerMessageId + ":" + agent.id,
            messageType: type,
            body,
            media,
            providerTimestamp: typeof message?.timestamp === "string" ? new Date(Number(message.timestamp) * 1000).toISOString() : null,
          });
        }
        if (agents.length === 0) {
          await insertWhatsAppInboundMessage({ organizationId: account.organization_id, accountId: account.id, agentId: null, contactId, providerMessageId, messageType: type, body, media, providerTimestamp: typeof message?.timestamp === "string" ? new Date(Number(message.timestamp) * 1000).toISOString() : null });
        }
        accepted += 1;
      }
    }
  }
  return Response.json({ received: true, accepted });
}
