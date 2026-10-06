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
