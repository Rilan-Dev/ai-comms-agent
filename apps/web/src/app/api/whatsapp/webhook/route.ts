import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getWhatsAppAccountByPhoneNumberId, insertWhatsAppInboundMessage, recordWhatsAppWebhookEvent, upsertWhatsAppContact } from "@ai-comms-agent/db";

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
  if (mode !== "subscribe" || !challenge || !process.env.WHATSAPP_VERIFY_TOKEN || token !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response("Forbidden", { status: 403 });
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
      const contactMap = new Map(contacts.map((c: any) => [String(c.wa_id ?? ""), String(c.profile?.name ?? "")]));
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      for (const message of messages) {
        const from = typeof message?.from === "string" ? message.from : "";
        const providerMessageId = typeof message?.id === "string" ? message.id : "";
        if (!from || !providerMessageId) continue;
        const contactId = await upsertWhatsAppContact({ organizationId: account.organization_id, accountId: account.id, phoneNumber: from, displayName: contactMap.get(from) || null, providerContactId: from });
        const type = typeof message?.type === "string" ? message.type : "unknown";
        const body = type === "text" && typeof message?.text?.body === "string" ? message.text.body : null;
        await insertWhatsAppInboundMessage({ organizationId: account.organization_id, accountId: account.id, contactId, providerMessageId, messageType: type, body, media: type === "text" ? {} : message?.[type] ?? {}, providerTimestamp: typeof message?.timestamp === "string" ? new Date(Number(message.timestamp) * 1000).toISOString() : null });
        accepted += 1;
      }
    }
  }
  return Response.json({ received: true, accepted });
}
