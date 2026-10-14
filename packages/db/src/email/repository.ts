import { query } from "../client";
import { decryptCredential, encryptCredential } from "../security";
import type { CapabilitySet, EmailAccount, EmailProviderType } from "@ai-comms-agent/shared";

type Row = Record<string, unknown>;

function decodeBytea(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value !== "string") throw new Error("Encrypted credential payload is not byte data");
  if (value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
  return Buffer.from(value, "base64");
}

function requiredRow(row: Row | undefined, entity: string): Row {
  if (!row) throw new Error(`${entity} query returned no row`);
  return row;
}

function account(row: Row): EmailAccount {
  const status = String(row.status);
  const mappedStatus =
    status === "connected" ? "connected" :
    status === "pending" ? "pending" :
    status === "revoked" ? "revoked" :
    status === "disconnected" ? "disconnected" :
    "error";

  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    provider: row.provider as EmailProviderType,
    email_address: String(row.email_address),
    display_name: (row.display_name as string | null) ?? undefined,
    capabilities: (row.capabilities ?? {}) as CapabilitySet,
    status: mappedStatus,
    last_sync_at: (row.last_synced_at as string | null) ?? undefined,
    last_error: (row.last_error as string | null) ?? undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export interface CreateEmailAccountInput {
  organizationId: string;
  provider: EmailProviderType;
  emailAddress: string;
  displayName?: string | null;
  connectionConfig?: Record<string, unknown>;
  capabilities: CapabilitySet;
  status?: "pending" | "connected";
}

export class PostgresEmailAccountRepository {
  async create(input: CreateEmailAccountInput): Promise<EmailAccount> {
    const r = await query<Row>(
      `INSERT INTO email_accounts
       (organization_id, provider, email_address, display_name, connection_config, capabilities, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       RETURNING *`,
      [
        input.organizationId,
        input.provider,
        input.emailAddress,
        input.displayName ?? null,
        JSON.stringify(input.connectionConfig ?? {}),
        JSON.stringify(input.capabilities),
        input.status ?? "connected",
      ],
    );
    return account(requiredRow(r.rows[0], "email account"));
  }

  async findByOrganizationProviderAddress(
    organizationId: string,
    provider: EmailProviderType,
    emailAddress: string,
  ): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "SELECT * FROM email_accounts WHERE organization_id = $1 AND provider = $2 AND email_address = $3 AND deleted_at IS NULL LIMIT 1",
      [organizationId, provider, emailAddress],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async updateConnection(
    id: string,
    input: {
      emailAddress: string;
      displayName?: string | null;
      connectionConfig: Record<string, unknown>;
      capabilities: CapabilitySet;
      status: "pending" | "connected" | "error" | "disconnected" | "revoked";
    },
  ): Promise<EmailAccount | null> {
    // Use $5 for the status column (enum type email_account_status) and $6
    // (a separate text parameter with the same value) for the CASE comparison.
    // PgBouncer/Prisma Postgres can't infer a single type when the same
    // parameter is used as both enum and text — it returns 42P08 "inconsistent
    // types deduced for parameter". Splitting into two params avoids this.
    const r = await query<Row>(
      `UPDATE email_accounts
       SET email_address = $1, display_name = $2, connection_config = $3::jsonb,
           capabilities = $4::jsonb, status = $5,
           last_error = NULL, connected_at = CASE WHEN $6 = 'connected' THEN now() ELSE connected_at END,
           updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [
        input.emailAddress,
        input.displayName ?? null,
        JSON.stringify(input.connectionConfig),
        JSON.stringify(input.capabilities),
        input.status,
        input.status, // duplicate as text param for CASE comparison
        id,
      ],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async getById(id: string): Promise<EmailAccount | null> {
    const r = await query<Row>("SELECT * FROM email_accounts WHERE id = $1 AND deleted_at IS NULL", [id]);
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async getForAgent(organizationId: string, agentId: string, accountId: string): Promise<EmailAccount | null> {
    const r = await query<Row>(
      `SELECT a.* FROM email_accounts a
       JOIN agent_email_accounts binding ON binding.email_account_id = a.id
       WHERE a.id = $1 AND a.organization_id = $2 AND binding.agent_id = $3 AND a.deleted_at IS NULL
       LIMIT 1`,
      [accountId, organizationId, agentId],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async listForOrganization(organizationId: string): Promise<EmailAccount[]> {
    const r = await query<Row>(
      "SELECT * FROM email_accounts WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId],
    );
    return r.rows.map(account);
  }

  async getConnectionConfig(id: string): Promise<Record<string, unknown>> {
    const r = await query<Row>("SELECT connection_config FROM email_accounts WHERE id = $1 AND deleted_at IS NULL", [id]);
    return (r.rows[0]?.connection_config ?? {}) as Record<string, unknown>;
  }

  async updateCapabilities(id: string, capabilities: CapabilitySet): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "UPDATE email_accounts SET capabilities = $1::jsonb WHERE id = $2 AND deleted_at IS NULL RETURNING *",
      [JSON.stringify(capabilities), id],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async updateSyncState(id: string, lastSyncAt: string): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "UPDATE email_accounts SET last_synced_at = $1, status = 'connected', last_error = NULL, connected_at = COALESCE(connected_at, now()) WHERE id = $2 AND deleted_at IS NULL RETURNING *",
      [lastSyncAt, id],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    // Persist the vector-sync request before removing the account. The
    // account_id in email_knowledge_sync_jobs deliberately has no FK so the
    // job survives account deletion and can target provider/account-scoped points.
    const r = await query<Row>(
      `WITH target AS MATERIALIZED (
         SELECT id, organization_id, provider::text AS provider
           FROM email_accounts
          WHERE id=$1
       ),
       cancelled_message_jobs AS (
         UPDATE email_knowledge_sync_jobs j
            SET status='completed', completed_at=now(), updated_at=now(),
                last_error='Superseded by account deletion'
           FROM target t
          WHERE j.organization_id=t.organization_id AND j.account_id=t.id
            AND j.operation IN ('upsert_message','delete_message')
            AND j.status IN ('pending','retry')
         RETURNING j.id
       ),
       cleanup AS (
         INSERT INTO email_knowledge_sync_jobs (organization_id, account_id, provider, operation, status)
         SELECT organization_id, id, provider, 'delete_account', 'pending' FROM target
         ON CONFLICT (organization_id, account_id) WHERE operation='delete_account' DO UPDATE
           SET status='pending', attempts=0, next_attempt_at=now(),
               last_error=NULL, completed_at=NULL, updated_at=now()
         RETURNING account_id
       ),
       purged_documents AS (
         DELETE FROM knowledge_documents d
          USING target t
          WHERE d.organization_id=t.organization_id
            AND d.storage_bucket='email-account'
            AND (
              d.metadata->>'email_account_id'=t.id::text
              OR d.storage_path LIKE t.id::text || '/%'
            )
         RETURNING d.id
       ),
       removed AS (
         DELETE FROM email_accounts a
          USING target t, cleanup c
          WHERE a.id=t.id AND c.account_id=t.id
         RETURNING a.id
       )
       SELECT id FROM removed`,
      [id],
    );
    return r.rows.length > 0;
  }

  async updateStatus(
    id: string,
    status: "pending" | "connected" | "error" | "disconnected" | "revoked",
    lastError?: string | null,
  ): Promise<EmailAccount | null> {
    const r = await query<Row>(
      "UPDATE email_accounts SET status = $1::email_account_status, last_error = CASE WHEN $1::email_account_status = 'error'::email_account_status THEN $2 ELSE NULL END, connected_at = CASE WHEN $1::email_account_status = 'connected'::email_account_status THEN COALESCE(connected_at, now()) ELSE connected_at END WHERE id = $3 AND deleted_at IS NULL RETURNING *",
      [status, lastError ?? null, id],
    );
    return r.rows[0] ? account(r.rows[0]) : null;
  }

  async saveCredentials(
    accountId: string,
    credentialType: "oauth_token" | "password" | "app_password",
    payload: Record<string, unknown>,
    masterKey: Buffer,
  ): Promise<void> {
    const encrypted = encryptCredential(JSON.stringify(payload), masterKey);
    await query(
      `INSERT INTO email_account_credentials
       (email_account_id, organization_id, ciphertext, key_reference, updated_at)
       VALUES ($1, (SELECT organization_id FROM email_accounts WHERE id = $1), $2, $3, now())
       ON CONFLICT (email_account_id)
       DO UPDATE SET ciphertext = EXCLUDED.ciphertext,
                     key_reference = EXCLUDED.key_reference,
                     updated_at = now()`,
      [accountId, encrypted, "credentials-master-key-v1"],
    );
  }

  async loadCredentials(accountId: string, masterKey: Buffer): Promise<Record<string, unknown> | null> {
    const r = await query<Row>(
      "SELECT ciphertext FROM email_account_credentials WHERE email_account_id = $1",
      [accountId],
    );
    if (!r.rows[0]?.ciphertext) return null;
    const raw = decryptCredential(
      decodeBytea(r.rows[0].ciphertext),
      masterKey,
    ).toString("utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  }
}

export { PostgresEmailAccountRepository as SupabaseEmailAccountRepository };

export interface MailInboxFilters {
  accountId?: string;
  query?: string;
  unreadOnly?: boolean;
  actionRequired?: boolean;
  limit?: number;
  offset?: number;
}

export async function listInboxMessages(organizationId: string, filters: MailInboxFilters = {}): Promise<Array<Record<string, unknown>>> {
  const values: unknown[] = [organizationId];
  const conditions = ["a.organization_id = $1", "a.deleted_at IS NULL"];
  if (filters.accountId) { values.push(filters.accountId); conditions.push(`m.email_account_id = $${values.length}`); }
  if (filters.unreadOnly) conditions.push("m.is_read = false");
  if (filters.actionRequired) conditions.push("m.action_required = true");
  if (filters.query?.trim()) { values.push(`%${filters.query.trim()}%`); conditions.push(`(m.subject ILIKE $${values.length} OR m.from_email ILIKE $${values.length} OR m.from_name ILIKE $${values.length} OR m.text_body ILIKE $${values.length} OR m.snippet ILIKE $${values.length})`); }
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100); const offset = Math.max(filters.offset ?? 0, 0);
  values.push(limit, offset);
  const r = await query<Row>(`SELECT m.id, m.email_account_id, m.thread_id, COALESCE(m.from_email, m.from_name, '') AS from_address, m.to_recipients AS to_addresses, m.subject, m.snippet, m.received_at, m.is_read, m.is_starred, m.is_draft, m.is_sent AS is_outbound, m.importance_score, m.action_required, EXISTS (SELECT 1 FROM email_attachments ea WHERE ea.message_id = m.id) AS has_attachments, a.email_address AS account_email, a.display_name AS account_name
    FROM email_messages m JOIN email_accounts a ON a.id = m.email_account_id
    WHERE ${conditions.join(" AND ")} ORDER BY m.received_at DESC NULLS LAST LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return r.rows;
}

export async function getMailMessageForOrganization(organizationId: string, messageId: string): Promise<Record<string, unknown> | null> {
  const r = await query<Row>(`SELECT m.*, COALESCE(m.from_email, m.from_name, '') AS from_address, m.to_recipients AS to_addresses, m.text_body, m.html_body_sanitized AS html_body, EXISTS (SELECT 1 FROM email_attachments ea WHERE ea.message_id = m.id) AS has_attachments, a.email_address AS account_email, a.display_name AS account_name
    FROM email_messages m JOIN email_accounts a ON a.id = m.email_account_id
    WHERE m.id = $1 AND a.organization_id = $2 AND a.deleted_at IS NULL LIMIT 1`, [messageId, organizationId]);
  return r.rows[0] ?? null;
}

export async function getMailAttachmentForOrganization(organizationId: string, attachmentId: string): Promise<Record<string, unknown> | null> {
  const r = await query<Row>(
    `SELECT id, message_id, organization_id, filename, content_type, size_bytes, storage_bucket, storage_path, sha256, scan_status
     FROM email_attachments
     WHERE id = $1 AND organization_id = $2
     LIMIT 1`,
    [attachmentId, organizationId],
  );
  return r.rows[0] ?? null;
}

export async function listMailAttachmentsForOrganization(organizationId: string, messageId: string): Promise<Array<Record<string, unknown>>> {
  const r = await query<Row>(
    `SELECT id, message_id, filename, content_type, size_bytes, storage_bucket, storage_path, sha256, scan_status, created_at
     FROM email_attachments
     WHERE organization_id = $1 AND message_id = $2
     ORDER BY created_at ASC`,
    [organizationId, messageId],
  );
  return r.rows;
}

export async function getMailThreadForOrganization(organizationId: string, threadId: string): Promise<Array<Record<string, unknown>>> {
  const r = await query<Row>(`SELECT m.*, a.email_address AS account_email, a.display_name AS account_name
    FROM email_messages m JOIN email_accounts a ON a.id = m.email_account_id
    WHERE m.thread_id = $1 AND a.organization_id = $2 AND a.deleted_at IS NULL
    ORDER BY m.received_at ASC NULLS LAST`, [threadId, organizationId]);
  return r.rows;
}

export async function updateMailReadStateForOrganization(
  organizationId: string,
  messageIds: string[],
  isRead: boolean,
): Promise<number> {
  if (messageIds.length === 0) return 0;
  const r = await query<{ id: string }>(
    `UPDATE email_messages m
     SET is_read = $1, updated_at = now()
     FROM email_accounts a
     WHERE m.email_account_id = a.id
       AND a.organization_id = $2
       AND a.deleted_at IS NULL
       AND m.id = ANY($3::uuid[])
     RETURNING m.id`,
    [isRead, organizationId, messageIds],
  );
  return r.rows.length;
}

export async function archiveMailMessagesForOrganization(
  organizationId: string,
  messageIds: string[],
): Promise<number> {
  if (messageIds.length === 0) return 0;
  const r = await query<{ id: string }>(
    `UPDATE email_messages m
     SET folder_id = f.id, updated_at = now()
     FROM email_accounts a
     JOIN email_folders f ON f.email_account_id = a.id AND f.role = 'archive'
     WHERE m.email_account_id = a.id
       AND a.organization_id = $1
       AND a.deleted_at IS NULL
       AND m.id = ANY($2::uuid[])
     RETURNING m.id`,
    [organizationId, messageIds],
  );
  return r.rows.length;
}

export async function moveMailMessagesForOrganization(
  organizationId: string,
  messageIds: string[],
  folderId: string,
): Promise<number> {
  if (messageIds.length === 0) return 0;
  const r = await query<{ id: string }>(
    `UPDATE email_messages m
     SET folder_id = f.id, updated_at = now()
     FROM email_accounts a
     JOIN email_folders f ON f.id = $2 AND f.email_account_id = a.id
     WHERE m.email_account_id = a.id
       AND a.organization_id = $1
       AND a.deleted_at IS NULL
       AND m.id = ANY($3::uuid[])
     RETURNING m.id`,
    [organizationId, folderId, messageIds],
  );
  return r.rows.length;
}

export async function listMailFoldersForOrganization(
  organizationId: string,
  accountId?: string,
): Promise<Array<Record<string, unknown>>> {
  const values: unknown[] = [organizationId];
  const conditions = ["a.organization_id = $1", "a.deleted_at IS NULL"];
  // IMPORTANT: use $${values.length} (double-$$) to produce the PostgreSQL
  // parameter placeholder $2, $3, etc. Single-$$ would inject the literal
  // integer into the SQL string, producing `f.email_account_id = 2` which
  // fails with "operator does not exist: uuid = integer" because
  // email_account_id is a UUID column and there's no implicit integer→uuid cast.
  if (accountId) { values.push(accountId); conditions.push(`f.email_account_id = $${values.length}`); }
  const r = await query<Row>(
    `SELECT f.id, f.email_account_id, f.provider_folder_id, f.name, f.role, f.unread_count
     FROM email_folders f JOIN email_accounts a ON a.id = f.email_account_id
     WHERE ${conditions.join(" AND ")} ORDER BY f.name ASC`,
    values,
  );
  return r.rows;
}
export interface CreateLocalDraftInput {
  organizationId: string;
  emailAccountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  bodyText?: string;
}

export async function createLocalDraft(input: CreateLocalDraftInput): Promise<Record<string, unknown>> {
  const accountResult = await query<Row>(
    "SELECT id, email_address FROM email_accounts WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL LIMIT 1",
    [input.emailAccountId, input.organizationId],
  );
  if (!accountResult.rows[0]) throw new Error("Email account was not found in this organization.");
  const threadResult = await query<Row>(
    `INSERT INTO email_threads (email_account_id, organization_id, subject, normalized_subject, participant_emails)
     VALUES ($1, $2, $3, lower(regexp_replace(coalesce($3,''), '^([[:space:]]*(re|fwd):[[:space:]]*)+', '', 'gi')), $4::citext[])
     RETURNING id`,
    [input.emailAccountId, input.organizationId, input.subject?.trim() || null, [...input.to, String(accountResult.rows[0].email_address)]],
  );
  const threadId = String(requiredRow(threadResult.rows[0], "draft thread").id);
  const messageResult = await query<Row>(
    `INSERT INTO email_messages
      (email_account_id, organization_id, thread_id, provider_message_id, from_email, to_recipients, cc_recipients, bcc_recipients, subject, text_body, snippet, is_read, is_draft, is_sent, received_at)
     VALUES ($1, $2, $3, 'local-draft:' || gen_random_uuid()::text, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, left($9, 240), true, true, false, now())
     RETURNING id, thread_id, email_account_id, from_email, to_recipients, cc_recipients, bcc_recipients, subject, text_body, is_draft, updated_at`,
    [input.emailAccountId, input.organizationId, threadId, accountResult.rows[0].email_address, JSON.stringify(input.to), JSON.stringify(input.cc ?? []), JSON.stringify(input.bcc ?? []), input.subject?.trim() || null, input.bodyText ?? ""],
  );
  return requiredRow(messageResult.rows[0], "draft message");
}

export async function updateLocalDraftForOrganization(
  organizationId: string,
  messageId: string,
  input: Partial<Pick<CreateLocalDraftInput, "to" | "cc" | "bcc" | "subject" | "bodyText">>,
): Promise<Record<string, unknown> | null> {
  const values: unknown[] = [];
  const sets: string[] = [];
  if (input.to) { values.push(JSON.stringify(input.to)); sets.push(`to_recipients = $${values.length}::jsonb`); }
  if (input.cc) { values.push(JSON.stringify(input.cc)); sets.push(`cc_recipients = $${values.length}::jsonb`); }
  if (input.bcc) { values.push(JSON.stringify(input.bcc)); sets.push(`bcc_recipients = $${values.length}::jsonb`); }
  if (input.subject !== undefined) { values.push(input.subject.trim() || null); sets.push(`subject = $${values.length}`); }
  if (input.bodyText !== undefined) { values.push(input.bodyText); sets.push(`text_body = $${values.length}, snippet = left($${values.length}, 240)`); }
  if (!sets.length) return getMailMessageForOrganization(organizationId, messageId);
  values.push(messageId, organizationId);
  const r = await query<Row>(
    `UPDATE email_messages m SET ${sets.join(", ")}, updated_at = now()
     FROM email_accounts a
     WHERE m.id = $${values.length - 1} AND m.email_account_id = a.id AND a.organization_id = $${values.length} AND m.is_draft = true AND a.deleted_at IS NULL
     RETURNING m.*`,
    values,
  );
  return r.rows[0] ?? null;
}


export async function listLocalDraftsForOrganization(organizationId: string): Promise<Array<Record<string, unknown>>> {
  const r = await query<Row>(
    `SELECT m.id, m.email_account_id, m.thread_id, m.from_email, m.to_recipients, m.cc_recipients, m.bcc_recipients,
            m.subject, m.text_body, m.provider_message_id, m.provider_draft_id, m.provider_draft_sync_status, m.provider_draft_synced_at, m.provider_draft_last_error, m.updated_at, a.email_address AS account_email, a.display_name AS account_name
     FROM email_messages m
     JOIN email_accounts a ON a.id = m.email_account_id
     WHERE m.organization_id = $1 AND a.organization_id = $1 AND a.deleted_at IS NULL AND m.is_draft = true
     ORDER BY m.updated_at DESC`,
    [organizationId],
  );
  return r.rows;
}

export async function listDraftsPendingProviderSync(limit = 25): Promise<Array<{ id: string; organization_id: string }>> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const r = await query<Row>(
    `SELECT m.id, m.organization_id
     FROM email_messages m
     JOIN email_accounts a ON a.id = m.email_account_id
     WHERE m.is_draft = true
       AND m.provider_draft_sync_status = 'syncing'
       AND a.deleted_at IS NULL
     ORDER BY m.updated_at ASC
     LIMIT $1`,
    [safeLimit],
  );
  return r.rows.map(row => ({ id: String(row.id), organization_id: String(row.organization_id) }));
}

export async function markDraftProviderSyncingForOrganization(organizationId: string, messageId: string) {
  const r = await query<Row>(
    `UPDATE email_messages m
     SET provider_draft_sync_status = 'syncing', provider_draft_last_error = NULL, updated_at = now()
     FROM email_accounts a
     WHERE m.id = $1 AND m.organization_id = $2 AND m.email_account_id = a.id
       AND a.organization_id = $2 AND a.deleted_at IS NULL AND m.is_draft = true
     RETURNING m.*`,
    [messageId, organizationId],
  );
  return r.rows[0] ?? null;
}

export async function markDraftProviderSyncedForOrganization(
  organizationId: string,
  messageId: string,
  providerDraftId: string,
) {
  const r = await query<Row>(
    `UPDATE email_messages m
     SET provider_draft_id = $1, provider_draft_sync_status = 'synced', provider_draft_synced_at = now(), provider_draft_last_error = NULL, updated_at = now()
     FROM email_accounts a
     WHERE m.id = $2 AND m.organization_id = $3 AND m.email_account_id = a.id
       AND a.organization_id = $3 AND a.deleted_at IS NULL AND m.is_draft = true
     RETURNING m.*`,
    [providerDraftId, messageId, organizationId],
  );
  return r.rows[0] ?? null;
}

export async function markDraftProviderSyncErrorForOrganization(
  organizationId: string,
  messageId: string,
  error: string,
) {
  const r = await query<Row>(
    `UPDATE email_messages m
     SET provider_draft_sync_status = 'error', provider_draft_last_error = left($1, 2000), updated_at = now()
     FROM email_accounts a
     WHERE m.id = $2 AND m.organization_id = $3 AND m.email_account_id = a.id
       AND a.organization_id = $3 AND a.deleted_at IS NULL AND m.is_draft = true
     RETURNING m.*`,
    [error, messageId, organizationId],
  );
  return r.rows[0] ?? null;
}

export async function getLocalDraftForOrganization(organizationId: string, messageId: string) {
  const r = await query<Row>(
    `SELECT m.*, a.email_address AS account_email, a.display_name AS account_name
     FROM email_messages m JOIN email_accounts a ON a.id = m.email_account_id
     WHERE m.id = $1 AND m.organization_id = $2 AND a.organization_id = $2 AND a.deleted_at IS NULL AND m.is_draft = true
     LIMIT 1`,
    [messageId, organizationId],
  );
  return r.rows[0] ?? null;
}


export async function markLocalDraftSentForOrganization(
  organizationId: string,
  messageId: string,
  providerMessageId: string,
): Promise<Record<string, unknown> | null> {
  const r = await query<Row>(
    `UPDATE email_messages m
     SET is_draft = false, is_sent = true, provider_message_id = $1, updated_at = now()
     FROM email_accounts a
     WHERE m.id = $2 AND m.organization_id = $3 AND m.email_account_id = a.id
       AND a.organization_id = $3 AND a.deleted_at IS NULL
     RETURNING m.*`,
    [providerMessageId, messageId, organizationId],
  );
  return r.rows[0] ?? null;
}

export async function deleteLocalDraftForOrganization(organizationId: string, messageId: string): Promise<boolean> {
  const r = await query<Row>(
    `DELETE FROM email_messages m
     USING email_accounts a
     WHERE m.id = $1 AND m.organization_id = $2 AND m.email_account_id = a.id
       AND a.organization_id = $2 AND a.deleted_at IS NULL AND m.is_draft = true
     RETURNING m.id`,
    [messageId, organizationId],
  );
  return r.rows.length > 0;
}
