import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../client";
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

export async function createOrUpdateWhatsAppAccount(input: { organizationId: string; accountId?: string; businessAccountId?: string | null; phoneNumberId: string; phoneNumber?: string | null; displayName?: string | null; capabilities?: Record<string, boolean>; status?: "pending" | "connected" | "error" | "disconnected" | "revoked"; createdBy: string; verifyToken?: string; }) {
  // Look up by accountId OR by phone_number_id. The phone_number_id column
  // has a GLOBAL UNIQUE constraint — if a previous account with the same
  // phone_number_id exists (even soft-deleted), INSERT would fail with
  // 23505 "duplicate key value violates unique constraint". By looking up
  // by phone_number_id first, we UPDATE the existing row instead of
  // INSERTing a duplicate.
  let existing = input.accountId ? await getWhatsAppAccountForOrganization(input.organizationId, input.accountId) : null;
  if (!existing && input.phoneNumberId) {
    // Check for an existing account with the same phone_number_id in this org
    // (including soft-deleted ones — we'll restore them).
    const r = await query<Row>(
      "SELECT * FROM whatsapp_accounts WHERE phone_number_id = $1 AND organization_id = $2 LIMIT 1",
      [input.phoneNumberId, input.organizationId],
    );
    if (r.rows[0]) {
      // Restore a soft-deleted account: clear deleted_at, update fields
      existing = mapAccount(r.rows[0]);
    }
  }
  if (existing) {
    const values: unknown[] = [input.businessAccountId ?? null, input.phoneNumberId, input.phoneNumber ?? null, input.displayName ?? null, JSON.stringify(input.capabilities ?? { send_text: true, receive_text: true }), input.status ?? "pending"];
    let setClause = "business_account_id = $1, phone_number_id = $2, phone_number = $3, display_name = $4, capabilities = $5::jsonb, status = $6, last_error = NULL, deleted_at = NULL, connected_at = CASE WHEN $6 = 'connected' THEN now() ELSE connected_at END";
    if (input.verifyToken) {
      values.push(input.verifyToken);
      setClause += `, verify_token = $${values.length}`;
    }
    values.push(existing.id, input.organizationId);
    const r = await query<Row>(`UPDATE whatsapp_accounts SET ${setClause} WHERE id = $${values.length - 1} AND organization_id = $${values.length} RETURNING *`, values);
    return r.rows[0] ? mapAccount(r.rows[0]) : null;
  }
  // Generate a verify_token if not provided — use a random UUID-based token
  const verifyToken = input.verifyToken || randomUUID().replace(/-/g, "");
  const r = await query<Row>("INSERT INTO whatsapp_accounts (organization_id, business_account_id, phone_number_id, phone_number, display_name, capabilities, status, verify_token, created_by) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING *", [input.organizationId, input.businessAccountId ?? null, input.phoneNumberId, input.phoneNumber ?? null, input.displayName ?? null, JSON.stringify(input.capabilities ?? { send_text: true, receive_text: true }), input.status ?? "pending", verifyToken, input.createdBy]);
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

// Check a webhook verify token against ALL whatsapp_accounts in the DB.
// Returns the matching account if found, null otherwise.
// Used by the webhook GET route to verify Meta's subscription ping
// WITHOUT requiring WHATSAPP_VERIFY_TOKEN env var — the token is stored
// per-account in the whatsapp_accounts.verify_token column.
export async function findWhatsAppAccountByVerifyToken(token: string) {
  if (!token) return null;
  const r = await query<Row>(
    "SELECT id, organization_id, phone_number_id, verify_token FROM whatsapp_accounts WHERE verify_token = $1 AND deleted_at IS NULL LIMIT 1",
    [token],
  );
  return r.rows[0] ? { id: String(r.rows[0].id), organization_id: String(r.rows[0].organization_id), phone_number_id: String(r.rows[0].phone_number_id) } : null;
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

export async function getWhatsAppAccountForAgent(organizationId: string, agentId: string) {
  const r = await query<Row>(
    "SELECT w.id, w.organization_id, w.provider, w.business_account_id, w.phone_number_id, w.phone_number, w.display_name, w.status, w.capabilities, w.connected_at, w.last_error, w.created_at, w.updated_at FROM agent_whatsapp_accounts b JOIN whatsapp_accounts w ON w.id = b.whatsapp_account_id WHERE w.organization_id = $1 AND b.agent_id = $2 AND w.deleted_at IS NULL ORDER BY w.created_at ASC LIMIT 1",
    [organizationId, agentId],
  );
  return r.rows[0] ? mapAccount(r.rows[0]) : null;
}

export async function listAgentsForWhatsAppAccount(organizationId: string, accountId: string) {
  const r = await query<Row>(
    "SELECT a.id, a.name, a.slug FROM agent_whatsapp_accounts b JOIN agents a ON a.id = b.agent_id WHERE a.organization_id = $1 AND b.whatsapp_account_id = $2 ORDER BY a.name ASC",
    [organizationId, accountId],
  );
  return r.rows.map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug) }));
}

export async function insertWhatsAppInboundMessage(input: { organizationId: string; accountId: string; agentId?: string | null; contactId?: string | null; providerMessageId: string; messageType: string; body?: string | null; media?: Record<string, unknown>; providerTimestamp?: string | null }) {
  // $3 (agent_id) is referenced twice: once as the column value and once inside
  // the CASE expression. PostgreSQL cannot infer a parameter type from an
  // `IS NULL` test (SQLSTATE 42P08 "could not determine data type of parameter
  // $3"), so the uuid cast is required for the statement to parse.
  const r = await query<Row>(
    "INSERT INTO whatsapp_messages (organization_id, whatsapp_account_id, agent_id, contact_id, direction, provider_message_id, message_type, body, media, status, processing_status, provider_timestamp, correlation_id) VALUES ($1,$2,$3::uuid,$4,'inbound',$5,$6,$7,$8::jsonb,'received',CASE WHEN $3::uuid IS NULL THEN 'received' ELSE 'routed' END,$9,gen_random_uuid()) ON CONFLICT DO NOTHING RETURNING id",
    [input.organizationId, input.accountId, input.agentId ?? null, input.contactId ?? null, input.providerMessageId, input.messageType, input.body ?? null, JSON.stringify(input.media ?? {}), input.providerTimestamp ?? null],
  );
  return { inserted: r.rows.length > 0, id: r.rows[0]?.id ? String(r.rows[0].id) : null };
}

export async function claimRoutedWhatsAppInbound(limit = 10) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  return withTransaction(async (client) => {
    const selected = await client.query<Row>(
      "SELECT m.*, c.phone_number, c.display_name FROM whatsapp_messages m JOIN whatsapp_contacts c ON c.id = m.contact_id WHERE m.direction = 'inbound' AND m.processing_status = 'routed' AND m.agent_id IS NOT NULL ORDER BY m.created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED",
      [safeLimit],
    );
    const claimed: Row[] = [];
    for (const row of selected.rows) {
      const updated = await client.query<Row>(
        "UPDATE whatsapp_messages SET processing_status = 'processing', updated_at = now() WHERE id = $1 AND processing_status = 'routed' RETURNING *",
        [row.id],
      );
      if (updated.rows[0]) claimed.push({ ...updated.rows[0], phone_number: row.phone_number, display_name: row.display_name });
    }
    return claimed;
  });
}

export async function completeWhatsAppInbound(messageId: string, status: "completed" | "failed", error?: string | null) {
  const r = await query<Row>(
    "UPDATE whatsapp_messages SET processing_status = $1, provider_error = CASE WHEN $1 = 'failed' THEN left($2,2000) ELSE provider_error END, updated_at = now() WHERE id = $3 AND direction = 'inbound' AND processing_status = 'processing' RETURNING id",
    [status, error ?? null, messageId],
  );
  return r.rows.length > 0;
}

export async function queueWhatsAppOutboundMessage(input: {
  organizationId: string;
  accountId: string;
  contactId?: string | null;
  to: string;
  body: string;
  idempotencyKey: string;
  correlationId?: string | null;
  messageType?: "text" | "template";
  media?: Record<string, unknown>;
}) {
  const contactId = input.contactId ?? await upsertWhatsAppContact({ organizationId: input.organizationId, accountId: input.accountId, phoneNumber: input.to });
  const messageType = input.messageType ?? "text";
  const media = input.media ?? {};
  const r = await query<Row>(
    "INSERT INTO whatsapp_messages (organization_id, whatsapp_account_id, contact_id, direction, message_type, body, media, status, idempotency_key, correlation_id) VALUES ($1,$2,$3,'outbound',$4,$5,$6::jsonb,'queued',$7,$8) ON CONFLICT (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING id",
    [input.organizationId, input.accountId, contactId, messageType, input.body, JSON.stringify(media), input.idempotencyKey, input.correlationId ?? null],
  );
  if (r.rows[0]?.id) return String(r.rows[0].id);

  const existing = await query<Row>(
    "SELECT whatsapp_account_id, contact_id, body, message_type, media, media = $3::jsonb AS media_matches FROM whatsapp_messages WHERE organization_id = $1 AND idempotency_key = $2 AND direction = 'outbound' LIMIT 1",
    [input.organizationId, input.idempotencyKey, JSON.stringify(media)],
  );
  const row = existing.rows[0];
  if (!row) throw new Error("WhatsApp idempotency conflict could not be resolved");
  if (String(row.whatsapp_account_id) !== input.accountId
    || String(row.contact_id) !== String(contactId)
    || String(row.body ?? "") !== input.body
    || String(row.message_type ?? "text") !== messageType
    || row.media_matches !== true) {
    throw new Error("Idempotency key already exists for a different WhatsApp payload");
  }
  return row.id ? String(row.id) : null;
}

export async function claimQueuedWhatsAppOutbound(limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const r = await query<Row>(
    `WITH candidates AS (
       SELECT id FROM whatsapp_messages
       WHERE direction = 'outbound' AND status = 'queued'
       ORDER BY created_at ASC, id ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     ),
     claimed AS (
       UPDATE whatsapp_messages m
       SET status = 'executing', updated_at = now()
       FROM candidates c
       WHERE m.id = c.id AND m.status = 'queued'
       RETURNING m.*
     )
     SELECT claimed.*, contacts.phone_number
     FROM claimed
     JOIN whatsapp_contacts contacts ON contacts.id = claimed.contact_id
     ORDER BY claimed.created_at ASC, claimed.id ASC`,
    [safeLimit],
  );
  return r.rows;
}

export async function markWhatsAppOutboundSent(messageId: string, providerMessageId: string) {
  const r = await query<Row>("UPDATE whatsapp_messages SET status = 'sent', provider_message_id = $1, updated_at = now() WHERE id = $2 AND direction = 'outbound' AND status = 'executing' RETURNING id", [providerMessageId, messageId]);
  return r.rows.length > 0;
}

export async function markWhatsAppOutboundFailed(messageId: string, error: string) {
  const r = await query<Row>("UPDATE whatsapp_messages SET status = 'failed', provider_error = left($2,2000), updated_at = now() WHERE id = $1 AND direction = 'outbound' AND status = 'executing' RETURNING id", [messageId, error]);
  return r.rows.length > 0;
}

/**
 * Do not requeue abandoned outbound sends: Meta may have accepted the request
 * before the worker died. Record an unknown outcome for manual verification.
 */
export async function recoverStaleWhatsAppOutbound(maxAgeMinutes = 15) {
  const safeAge = Math.min(Math.max(Math.floor(maxAgeMinutes), 1), 24 * 60);
  const r = await query<Row>(
    `UPDATE whatsapp_messages
     SET status = 'failed',
         provider_error = 'Worker execution interrupted; provider outcome is unknown. Manual verification required.',
         updated_at = now()
     WHERE direction = 'outbound'
       AND status = 'executing'
       AND updated_at < now() - make_interval(mins => $1)
     RETURNING id, organization_id, whatsapp_account_id, correlation_id`,
    [safeAge],
  );
  return r.rows.map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    accountId: String(row.whatsapp_account_id),
    correlationId: row.correlation_id ? String(row.correlation_id) : null,
  }));
}

export async function applyWhatsAppProviderStatus(input: { organizationId: string; accountId: string; providerMessageId: string; status: "sent" | "delivered" | "read" | "failed"; error?: string | null; timestamp?: string | null }) {
  const r = await query<Row>(
    "UPDATE whatsapp_messages SET status = CASE WHEN $1 = 'failed' THEN 'failed' WHEN $1 = 'read' THEN 'read' WHEN $1 = 'delivered' AND status NOT IN ('read') THEN 'delivered' WHEN $1 = 'sent' AND status NOT IN ('delivered','read') THEN 'sent' ELSE status END, provider_error = CASE WHEN $1 = 'failed' THEN left($5,2000) ELSE provider_error END, delivered_at = CASE WHEN $1 IN ('delivered','read') THEN COALESCE(delivered_at, $2::timestamptz) ELSE delivered_at END, read_at = CASE WHEN $1 = 'read' THEN COALESCE(read_at, $2::timestamptz) ELSE read_at END, updated_at = now() WHERE provider_message_id = $3 AND organization_id = $4 AND whatsapp_account_id = $6 RETURNING id, organization_id, whatsapp_account_id",
    [input.status, input.timestamp ?? new Date().toISOString(), input.providerMessageId, input.organizationId, input.error ?? null, input.accountId],
  );
  return r.rows[0] ? { id: String(r.rows[0].id), organizationId: String(r.rows[0].organization_id), accountId: String(r.rows[0].whatsapp_account_id) } : null;
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


/**
 * Fail closed on abandoned inbound processing. Replaying automatically could
 * duplicate an agent response after the worker crashed after execution.
 */
export async function recoverStaleWhatsAppInbound(maxAgeMinutes = 15) {
  const safeAge = Math.min(Math.max(Math.floor(maxAgeMinutes), 1), 24 * 60);
  const r = await query<Row>(
    `UPDATE whatsapp_messages
     SET processing_status = 'failed',
         provider_error = 'Worker processing interrupted; downstream execution outcome is unknown. Manual review required.',
         updated_at = now()
     WHERE direction = 'inbound'
       AND processing_status = 'processing'
       AND updated_at < now() - make_interval(mins => $1)
     RETURNING id, organization_id, correlation_id, agent_id`,
    [safeAge],
  );
  return r.rows.map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    correlationId: row.correlation_id ? String(row.correlation_id) : null,
    agentId: row.agent_id ? String(row.agent_id) : null,
  }));
}
