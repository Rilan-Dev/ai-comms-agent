import { query } from "../client";
import { decryptCredential, encryptCredential } from "../security";

type Row = Record<string, unknown>;

function mapAccount(row: Row) {
  return {
    id: String(row.id), organization_id: String(row.organization_id), provider: String(row.provider),
    business_account_id: row.business_account_id ? String(row.business_account_id) : null,
    phone_number_id: String(row.phone_number_id), phone_number: row.phone_number ? String(row.phone_number) : null,
    display_name: row.display_name ? String(row.display_name) : null, status: String(row.status),
    capabilities: (row.capabilities ?? {}) as Record<string, boolean>, connected_at: row.connected_at ? String(row.connected_at) : null,
    last_error: row.last_error ? String(row.last_error) : null, created_at: String(row.created_at), updated_at: String(row.updated_at),
  };
}

export async function listWhatsAppAccountsForOrganization(organizationId: string) {
  const r = await query<Row>("SELECT id, organization_id, provider, business_account_id, phone_number_id, phone_number, display_name, status, capabilities, connected_at, last_error, created_at, updated_at FROM whatsapp_accounts WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC", [organizationId]);
  return r.rows.map(mapAccount);
}

export async function getWhatsAppAccountForOrganization(organizationId: string, accountId: string) {
  const r = await query<Row>("SELECT * FROM whatsapp_accounts WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL LIMIT 1", [accountId, organizationId]);
  return r.rows[0] ? mapAccount(r.rows[0]) : null;
}

export async function createOrUpdateWhatsAppAccount(input: { organizationId: string; accountId?: string; businessAccountId?: string | null; phoneNumberId: string; phoneNumber?: string | null; displayName?: string | null; capabilities?: Record<string, boolean>; status?: "pending" | "connected" | "error" | "disconnected" | "revoked"; createdBy: string; }) {
  const existing = input.accountId ? await getWhatsAppAccountForOrganization(input.organizationId, input.accountId) : null;
  if (existing) {
    const r = await query<Row>("UPDATE whatsapp_accounts SET business_account_id = $1, phone_number_id = $2, phone_number = $3, display_name = $4, capabilities = $5::jsonb, status = $6, last_error = NULL, connected_at = CASE WHEN $6 = 'connected' THEN now() ELSE connected_at END WHERE id = $7 AND organization_id = $8 AND deleted_at IS NULL RETURNING *", [input.businessAccountId ?? null, input.phoneNumberId, input.phoneNumber ?? null, input.displayName ?? null, JSON.stringify(input.capabilities ?? { send_text: true, receive_text: true }), input.status ?? "pending", input.accountId, input.organizationId]);
    return r.rows[0] ? mapAccount(r.rows[0]) : null;
  }
  const r = await query<Row>("INSERT INTO whatsapp_accounts (organization_id, business_account_id, phone_number_id, phone_number, display_name, capabilities, status, created_by) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING *", [input.organizationId, input.businessAccountId ?? null, input.phoneNumberId, input.phoneNumber ?? null, input.displayName ?? null, JSON.stringify(input.capabilities ?? { send_text: true, receive_text: true }), input.status ?? "pending", input.createdBy]);
  return r.rows[0] ? mapAccount(r.rows[0]) : null;
}

export async function saveWhatsAppCredential(accountId: string, organizationId: string, payload: Record<string, unknown>, masterKey: Buffer) {
  const encrypted = encryptCredential(JSON.stringify(payload), masterKey);
  await query("UPDATE whatsapp_accounts SET credential_ciphertext = $1, credential_key_reference = $2, updated_at = now() WHERE id = $3 AND organization_id = $4 AND deleted_at IS NULL", [encrypted, "credentials-master-key-v1", accountId, organizationId]);
}

export async function loadWhatsAppCredential(accountId: string, organizationId: string, masterKey: Buffer) {
  const r = await query<Row>("SELECT credential_ciphertext FROM whatsapp_accounts WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL", [accountId, organizationId]);
  if (!r.rows[0]?.credential_ciphertext) return null;
  const raw = decryptCredential(r.rows[0].credential_ciphertext as Buffer, masterKey).toString("utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function disconnectWhatsAppAccount(organizationId: string, accountId: string) {
  const r = await query<Row>("UPDATE whatsapp_accounts SET status = 'disconnected', credential_ciphertext = NULL, credential_key_reference = NULL, connected_at = NULL, updated_at = now() WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL RETURNING id", [accountId, organizationId]);
  return r.rows.length > 0;
}

export async function listWhatsAppMessagesForOrganization(organizationId: string, accountId: string, limit = 100) {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const r = await query<Row>("SELECT m.id, m.whatsapp_account_id, m.contact_id, m.direction, m.provider_message_id, m.message_type, m.body, m.status, m.provider_timestamp, m.created_at, c.phone_number, c.display_name FROM whatsapp_messages m LEFT JOIN whatsapp_contacts c ON c.id = m.contact_id WHERE m.organization_id = $1 AND m.whatsapp_account_id = $2 ORDER BY m.created_at DESC LIMIT $3", [organizationId, accountId, safeLimit]);
  return r.rows;
}


export async function getWhatsAppAccountByPhoneNumberId(phoneNumberId: string) {
  const r = await query<Row>("SELECT * FROM whatsapp_accounts WHERE phone_number_id = $1 AND deleted_at IS NULL LIMIT 1", [phoneNumberId]);
  return r.rows[0] ? mapAccount(r.rows[0]) : null;
}

export async function recordWhatsAppWebhookEvent(input: { organizationId: string; accountId: string; providerEventId?: string | null; eventType: string; payloadHash: string; payload: Record<string, unknown> }) {
  const r = await query<Row>(
    "INSERT INTO whatsapp_webhook_events (organization_id, whatsapp_account_id, provider_event_id, event_type, payload_hash, payload, status) VALUES ($1,$2,$3,$4,$5,$6::jsonb,'received') ON CONFLICT DO NOTHING RETURNING id",
    [input.organizationId, input.accountId, input.providerEventId ?? null, input.eventType, input.payloadHash, JSON.stringify(input.payload)],
  );
  return { inserted: r.rows.length > 0, id: r.rows[0]?.id ? String(r.rows[0].id) : null };
}

export async function upsertWhatsAppContact(input: { organizationId: string; accountId: string; phoneNumber: string; displayName?: string | null; providerContactId?: string | null }) {
  const r = await query<Row>(
    "INSERT INTO whatsapp_contacts (organization_id, whatsapp_account_id, phone_number, display_name, provider_contact_id, last_interaction_at) VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (whatsapp_account_id, phone_number) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, whatsapp_contacts.display_name), provider_contact_id = COALESCE(EXCLUDED.provider_contact_id, whatsapp_contacts.provider_contact_id), last_interaction_at = now() RETURNING id",
    [input.organizationId, input.accountId, input.phoneNumber, input.displayName ?? null, input.providerContactId ?? null],
  );
  return r.rows[0]?.id ? String(r.rows[0].id) : null;
}

export async function insertWhatsAppInboundMessage(input: { organizationId: string; accountId: string; contactId?: string | null; providerMessageId: string; messageType: string; body?: string | null; media?: Record<string, unknown>; providerTimestamp?: string | null }) {
  const r = await query<Row>(
    "INSERT INTO whatsapp_messages (organization_id, whatsapp_account_id, contact_id, direction, provider_message_id, message_type, body, media, status, provider_timestamp) VALUES ($1,$2,$3,'inbound',$4,$5,$6,$7::jsonb,'received',$8) ON CONFLICT DO NOTHING RETURNING id",
    [input.organizationId, input.accountId, input.contactId ?? null, input.providerMessageId, input.messageType, input.body ?? null, JSON.stringify(input.media ?? {}), input.providerTimestamp ?? null],
  );
  return { inserted: r.rows.length > 0, id: r.rows[0]?.id ? String(r.rows[0].id) : null };
}

export async function queueWhatsAppOutboundMessage(input: { organizationId: string; accountId: string; contactId?: string | null; to: string; body: string; idempotencyKey: string }) {
  const contactId = input.contactId ?? await upsertWhatsAppContact({ organizationId: input.organizationId, accountId: input.accountId, phoneNumber: input.to });
  const r = await query<Row>(
    "INSERT INTO whatsapp_messages (organization_id, whatsapp_account_id, contact_id, direction, message_type, body, status, idempotency_key) VALUES ($1,$2,$3,'outbound','text',$4,'queued',$5) ON CONFLICT (organization_id, idempotency_key) DO NOTHING RETURNING id",
    [input.organizationId, input.accountId, contactId, input.body, input.idempotencyKey],
  );
  return r.rows[0]?.id ? String(r.rows[0].id) : null;
}

export async function listQueuedWhatsAppOutbound(limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const r = await query<Row>("SELECT m.*, c.phone_number FROM whatsapp_messages m JOIN whatsapp_contacts c ON c.id = m.contact_id WHERE m.direction = 'outbound' AND m.status = 'queued' ORDER BY m.created_at ASC LIMIT $1", [safeLimit]);
  return r.rows;
}

export async function markWhatsAppOutboundSent(messageId: string, providerMessageId: string) {
  const r = await query<Row>("UPDATE whatsapp_messages SET status = 'sent', provider_message_id = $1, updated_at = now() WHERE id = $2 AND direction = 'outbound' AND status = 'queued' RETURNING id", [providerMessageId, messageId]);
  return r.rows.length > 0;
}

export async function markWhatsAppOutboundFailed(messageId: string, error: string) {
  const r = await query<Row>("UPDATE whatsapp_messages SET status = 'failed', updated_at = now() WHERE id = $1 AND direction = 'outbound' AND status = 'queued' RETURNING id", [messageId]);
  return r.rows.length > 0;
}


export async function listPendingWhatsAppAccounts(limit = 10) {
  const safeLimit = Math.min(Math.max(limit, 1), 25);
  const r = await query<Row>("SELECT id, organization_id, phone_number_id, status FROM whatsapp_accounts WHERE status = 'pending' AND deleted_at IS NULL ORDER BY updated_at ASC LIMIT $1", [safeLimit]);
  return r.rows;
}

export async function updateWhatsAppAccountStatus(organizationId: string, accountId: string, status: "pending" | "connected" | "error" | "disconnected" | "revoked", lastError?: string | null, phoneNumber?: string | null, displayName?: string | null) {
  const r = await query<Row>("UPDATE whatsapp_accounts SET status = $1, last_error = CASE WHEN $1 = 'error' THEN left($2,2000) ELSE NULL END, phone_number = COALESCE($3, phone_number), display_name = COALESCE($4, display_name), connected_at = CASE WHEN $1 = 'connected' THEN now() ELSE connected_at END, updated_at = now() WHERE id = $5 AND organization_id = $6 AND deleted_at IS NULL RETURNING id", [status, lastError ?? null, phoneNumber ?? null, displayName ?? null, accountId, organizationId]);
  return r.rows.length > 0;
}
