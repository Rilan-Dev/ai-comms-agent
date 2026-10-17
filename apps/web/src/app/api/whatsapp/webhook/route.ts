import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { applyWhatsAppProviderStatus, findWhatsAppAccountByVerifyToken, getWhatsAppAccountByPhoneNumberId, listWhatsAppAccountsForOrganization, insertWhatsAppInboundMessage, listAgentsForWhatsAppAccount, loadWhatsAppCredential, parseCredentialsMasterKey, recordWhatsAppWebhookEvent, upsertWhatsAppContact } from "@ai-comms-agent/db";

export const dynamic = "force-dynamic";

function signatureValid(raw: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const actual = signature.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/i.test(actual)) return false;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || !challenge) {
    return new Response("Bad Request — missing hub.mode=subscribe or hub.challenge", { status: 400 });
  }
  // DB-backed verify token: check against whatsapp_accounts.verify_token.
  // This eliminates the need for WHATSAPP_VERIFY_TOKEN env var — the token
  // is set per-account from the WhatsApp settings page when connecting.
  // Falls back to env var for backwards compatibility (if no DB account
  // has a matching verify_token).
  if (token) {
    const account = await findWhatsAppAccountByVerifyToken(token);
    if (account) {
      return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
    }
  }
  // Backwards-compat fallback: env var (for deployments that haven't migrated
  // to DB-stored verify tokens yet).
  if (process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Unauthorized — verify_token not found. Set the Verify Token in the WhatsApp settings page when connecting your phone.", { status: 401 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Always verify Meta's signature before processing events. If an environment
  // secret is not configured, load the encrypted organization webhook secret.
  // Parsing JSON above has no side effects; event writes happen only after HMAC
  // verification succeeds.
  let appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  if (!appSecret) {
    const masterKeyRaw = process.env.CREDENTIALS_MASTER_KEY;
    if (masterKeyRaw) {
      try {
        const masterKey = parseCredentialsMasterKey(masterKeyRaw);
        // Resolve the real phone number first, then load the webhook secret from
        // that same organization. The pseudo-account is not a real phone and
        // must never be selected globally across tenants.
        let organizationId: string | null = null;
        for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
          for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
            const phoneNumberId = typeof change?.value?.metadata?.phone_number_id === "string" ? change.value.metadata.phone_number_id : "";
            if (!phoneNumberId) continue;
            const account = await getWhatsAppAccountByPhoneNumberId(phoneNumberId);
            if (account) { organizationId = account.organization_id; break; }
          }
          if (organizationId) break;
        }
        if (organizationId) {
          const configAccount = (await listWhatsAppAccountsForOrganization(organizationId)).find((account) => account.phone_number_id === "__webhook_config__");
          if (configAccount) {
            const credential = await loadWhatsAppCredential(configAccount.id, organizationId, masterKey);
            appSecret = typeof credential?.app_secret === "string" ? credential.app_secret : "";
          }
        }
      } catch (error) {
        console.error("[whatsapp/webhook] Could not load saved signature secret:", error instanceof Error ? error.message : "unknown error");
      }
    }
  }
  if (!appSecret) {
    return new Response("Webhook signature verification is not configured", { status: 503 });
  }
  if (!signatureValid(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Forbidden", { status: 403 });
  }
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
