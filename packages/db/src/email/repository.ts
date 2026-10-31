import { query, withTransaction } from "../client";
import { decryptCredential, encryptCredential } from "../security";
import type { CapabilitySet, EmailAccount, EmailProviderType } from "@ai-comms-agent/shared";
import {replyMessageId,replyReferences,applyMailboxSignature,normalizeMailboxSignature} from "@ai-comms-agent/shared";
import { verifiedEmailHtml } from "@ai-comms-agent/shared";

type Row = Record<string, unknown>;

// Legacy rows may have raw HTML in html_body_sanitized. Never return such
// bytes to an email preview: compare against byte-exact canonical text-only
// HTML generated from this row's text_body. This guard is independent of
// tenant scoping; callers must retain their account/org predicates.
function quarantineMailHtmlRow(row: Row): Row {
  const safeHtml = verifiedEmailHtml(row.html_body_sanitized, row.text_body);
  return { ...row, html_body_sanitized: safeHtml, html_body: safeHtml };
}

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
    signature_text: typeof (row.connection_config as Record<string, unknown>|null)?.mailSignatureText === "string"
      ? String((row.connection_config as Record<string,unknown>).mailSignatureText) : null,
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
       SET email_address = $1, display_name = $2, connection_config = $3::jsonb || jsonb_build_object('mailSignatureText',coalesce(connection_config->>'mailSignatureText','')),
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
      "SELECT * FROM email_accounts WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
      [organizationId],
    );
    return r.rows.map(account);
  }

  /** Dedicated, tenant-scoped user-authored signature; writes cannot overwrite OAuth config. */
  async updateSignature(organizationId:string,accountId:string,signature:string):Promise<EmailAccount|null>{
    const normalized=normalizeMailboxSignature(signature);
    const r=await query<Row>(
      `UPDATE email_accounts SET connection_config=jsonb_set(coalesce(connection_config,'{}'::jsonb),'{mailSignatureText}',to_jsonb($3::text),true),
         updated_at=now()
       WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *`,
      [organizationId,accountId,normalized]);
    return r.rows[0]?account(r.rows[0]):null;
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
    const encrypted = encryptCredential(JSON.stringify({ ...payload, credential_type: credentialType }), masterKey);
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
  // An Inbox page must not surface the local draft rows created by Chat,
  // nor non-IMAP Sent/Archive folder rows. IMAP folder-qualified UID copies
  // keep requiring positive Inbox membership. For legacy non-IMAP rows with
  // no resolved folder, accept only non-outbound messages.
  const conditions = [
    "m.organization_id = $1",
    "a.organization_id = $1",
    "a.deleted_at IS NULL",
    "m.is_draft = false",
    "(EXISTS (SELECT 1 FROM email_folders inbox_folder WHERE inbox_folder.id = m.folder_id AND inbox_folder.email_account_id = m.email_account_id AND (inbox_folder.role = 'inbox' OR UPPER(inbox_folder.provider_folder_id) = 'INBOX')) OR (a.provider <> 'imap_smtp' AND m.folder_id IS NULL AND m.is_sent = false))",
  ];
  if (filters.accountId) { values.push(filters.accountId); conditions.push(`m.email_account_id = $${values.length}`); }
  if (filters.unreadOnly) conditions.push("m.is_read = false");
  if (filters.actionRequired) conditions.push("m.action_required = true");
  if (filters.query?.trim()) { values.push(`%${filters.query.trim()}%`); conditions.push(`(m.subject ILIKE $${values.length} OR m.from_email ILIKE $${values.length} OR m.from_name ILIKE $${values.length} OR m.text_body ILIKE $${values.length} OR m.snippet ILIKE $${values.length})`); }
  // Match the /api/mail/inbox contract (1..500). Capping here at 100
  // while advancing UI offsets by 500 silently skipped up to 400 messages.
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500); const offset = Math.max(filters.offset ?? 0, 0);
  values.push(limit, offset);
  const r = await query<Row>(`SELECT m.id, m.email_account_id, m.thread_id, COALESCE(m.from_email, m.from_name, '') AS from_address, m.to_recipients AS to_addresses, m.subject, m.snippet, m.received_at, m.is_read, m.is_starred, m.is_draft, m.is_sent AS is_outbound, m.importance_score, m.action_required, EXISTS (SELECT 1 FROM email_attachments ea WHERE ea.message_id = m.id) AS has_attachments, a.email_address AS account_email, a.display_name AS account_name
    FROM email_messages m JOIN email_accounts a ON a.id = m.email_account_id
    WHERE ${conditions.join(" AND ")} ORDER BY m.received_at DESC NULLS LAST, m.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return r.rows;
}

export async function getMailMessageForOrganization(organizationId: string, messageId: string): Promise<Record<string, unknown> | null> {
  const r = await query<Row>(`SELECT m.*, COALESCE(m.from_email, m.from_name, '') AS from_address, m.to_recipients AS to_addresses, m.text_body, m.html_body_sanitized AS html_body, EXISTS (SELECT 1 FROM email_attachments ea WHERE ea.message_id = m.id) AS has_attachments, a.email_address AS account_email, a.display_name AS account_name
    FROM email_messages m JOIN email_accounts a ON a.id = m.email_account_id
    WHERE m.id = $1 AND m.organization_id = $2 AND a.organization_id = $2 AND a.deleted_at IS NULL LIMIT 1`, [messageId, organizationId]);
  return r.rows[0] ? quarantineMailHtmlRow(r.rows[0]) : null;
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
  // Match the thread UI's html_body field using the stored email preview column.
  // The frame still treats every byte as untrusted; ingest sanitization is a
  // separate FIX-01 gate (issue #36), not implied by the column's name.
  // Keep physical IMAP folder copies for provider operations, but display
  // the same RFC822 Message-ID only once per account in a conversation.
  // Rows with no Message-ID, and all other providers, stay independent.
  const r = await query<Row>(`WITH ranked AS (
      SELECT m.*, m.html_body_sanitized AS html_body, a.email_address AS account_email, a.display_name AS account_name,
        ROW_NUMBER() OVER (
          PARTITION BY m.email_account_id,
            CASE WHEN a.provider = 'imap_smtp' AND NULLIF(BTRIM(m.internet_message_id), '') IS NOT NULL
              THEN 'message:' || LOWER(BTRIM(m.internet_message_id))
              ELSE 'row:' || m.id::text END
          ORDER BY CASE WHEN f.role = 'inbox' OR UPPER(f.provider_folder_id) = 'INBOX' THEN 0 ELSE 1 END,
            m.received_at DESC NULLS LAST, m.id
        ) AS duplicate_rank
      FROM email_messages m
      JOIN email_accounts a ON a.id = m.email_account_id
      LEFT JOIN email_folders f ON f.id = m.folder_id AND f.email_account_id = m.email_account_id
      WHERE m.thread_id = $1 AND m.organization_id = $2 AND a.organization_id = $2 AND a.deleted_at IS NULL
    )
    SELECT * FROM ranked WHERE duplicate_rank = 1
    ORDER BY received_at ASC NULLS LAST`, [threadId, organizationId]);
  return r.rows.map((row) => quarantineMailHtmlRow(row));
}

export async function updateMailReadStateForOrganization(
  organizationId: string,
  messageIds: string[],
  isRead: boolean,
): Promise<number> {
  if (!messageIds.length || new Set(messageIds.map(id => id.toLowerCase())).size !== messageIds.length) return 0;
  // A single mixed-tenant or missing ID must not mark the valid subset read.
  // Lock the exact tenant-owned selection before changing any of their flags.
  return withTransaction(async (client) => {
    const selected = await client.query<{ id: string }>(
      `SELECT m.id FROM email_messages m
       JOIN email_accounts a ON a.id = m.email_account_id
       WHERE m.organization_id = $1 AND a.organization_id = $1
         AND a.deleted_at IS NULL AND m.id = ANY($2::uuid[])
       ORDER BY m.id FOR UPDATE OF m FOR SHARE OF a`,
      [organizationId, messageIds],
    );
    if (selected.rows.length !== messageIds.length) return 0;

    const update = await client.query<{ id: string }>(
      `UPDATE email_messages m
       SET is_read = $1, updated_at = now()
       WHERE m.organization_id = $2 AND m.id = ANY($3::uuid[])
       RETURNING m.id`,
      [isRead, organizationId, messageIds],
    );
    if (update.rows.length !== messageIds.length) {
      throw new Error("Mail read-state batch update was incomplete; transaction rolled back.");
    }
    return update.rows.length;
  });
}

/**
 * A bulk archive/move must not mutate some of the requested messages and
 * then report 404 for the others. Lock and validate the entire selected set
 * and every destination before the first UPDATE. One transaction protects
 * the decision and mutation from racing deletions or concurrent moves.
 */
async function changeMailFoldersAtomically(
  organizationId: string,
  messageIds: string[],
  folderId: string | null,
): Promise<number> {
  if (!messageIds.length || new Set(messageIds.map(id => id.toLowerCase())).size !== messageIds.length) return 0;
  const ids = messageIds;

  return withTransaction(async (client) => {
    const selected = await client.query<{ id: string; email_account_id: string }>(
      `SELECT m.id, m.email_account_id
       FROM email_messages m
       JOIN email_accounts a ON a.id = m.email_account_id
       WHERE m.organization_id = $1 AND a.organization_id = $1
         AND a.deleted_at IS NULL AND m.id = ANY($2::uuid[])
       ORDER BY m.id
       FOR UPDATE OF m FOR SHARE OF a`,
      [organizationId, ids],
    );
    // All requested IDs must exist and belong to live accounts in this org.
    // Zero updates is the only valid result of an inaccessible mixed batch.
    if (selected.rows.length !== ids.length) return 0;

    const accounts = [...new Set(selected.rows.map(row => row.email_account_id))];
    let targets: Array<{ id: string; email_account_id: string }>;

    if (folderId) {
      const destination = await client.query<{ id: string; email_account_id: string }>(
        `SELECT f.id, f.email_account_id
         FROM email_folders f
         JOIN email_accounts a ON a.id = f.email_account_id
         WHERE f.id = $2 AND a.organization_id = $1 AND a.deleted_at IS NULL
         FOR SHARE OF f, a`,
        [organizationId, folderId],
      );
      // Moving messages from several accounts to one account's folder is
      // forbidden, even if some of their message IDs are valid.
      const destinationRow = destination.rows[0];
      if (!destinationRow || destination.rows.length !== 1 || accounts.length !== 1 ||
          destinationRow.email_account_id !== accounts[0]) return 0;
      targets = [destinationRow];
    } else {
      const destinations = await client.query<{ id: string; email_account_id: string }>(
        `SELECT f.id, f.email_account_id
         FROM email_folders f
         JOIN email_accounts a ON a.id = f.email_account_id
         WHERE a.organization_id = $1 AND a.deleted_at IS NULL
           AND f.role = 'archive' AND f.email_account_id = ANY($2::uuid[])
         FOR SHARE OF f, a`,
        [organizationId, accounts],
      );
      targets = destinations.rows;
      // Require exactly one archive destination per participating mailbox.
      // Never silently archive the subset whose provider folders happen to
      // exist or arbitrarily pick one of multiple role='archive' folders.
      if (targets.length !== accounts.length ||
          new Set(targets.map(row => row.email_account_id)).size !== accounts.length) return 0;
    }

    const destinationForAccount = new Map(targets.map(row => [row.email_account_id, row.id]));
    if (accounts.some(accountId => !destinationForAccount.has(accountId))) return 0;

    // Use the prevalidated, row-locked destination IDs; do not rejoin mutable
    // folder-role discovery after validation.
    const update = await client.query<{ id: string }>(
      `UPDATE email_messages m
       SET folder_id = target.folder_id, updated_at = now()
       FROM unnest($3::uuid[], $4::uuid[]) AS target(email_account_id, folder_id)
       WHERE m.organization_id = $1
         AND m.email_account_id = target.email_account_id
         AND m.id = ANY($2::uuid[])
       RETURNING m.id`,
      [organizationId, ids, accounts, accounts.map(accountId => destinationForAccount.get(accountId))],
    );
    if (update.rows.length !== ids.length) {
      // Invariant failure: rollback, never commit a partial mail mutation.
      throw new Error("Mail folder batch update was incomplete; transaction rolled back.");
    }
    return update.rows.length;
  });
}

export async function archiveMailMessagesForOrganization(
  organizationId: string,
  messageIds: string[],
): Promise<number> {
  return changeMailFoldersAtomically(organizationId, messageIds, null);
}

export async function moveMailMessagesForOrganization(
  organizationId: string,
  messageIds: string[],
  folderId: string,
): Promise<number> {
  return changeMailFoldersAtomically(organizationId, messageIds, folderId);
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
  replyToMessageId?: string;
}

export async function createLocalDraft(input: CreateLocalDraftInput): Promise<Record<string, unknown>> {
  // The draft thread must never persist without its message when an insert
  // fails. Lock the validated tenant account through the transaction so a
  // concurrent account deletion or reconnection cannot race these writes.
  return withTransaction(async (client) => {
  const accountResult = await client.query<Row>(
    "SELECT id, email_address, status, capabilities, connection_config->>'mailSignatureText' AS mail_signature FROM email_accounts WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL LIMIT 1 FOR SHARE",
    [input.emailAccountId, input.organizationId],
  );
  if (!accountResult.rows[0]) throw new Error("Email account was not found in this organization.");
  const signedBody=applyMailboxSignature(input.bodyText??"",accountResult.rows[0].mail_signature);
  if(signedBody.length>100000)throw new Error("Draft body including the saved signature exceeds 100000 characters.");
  const connected = accountResult.rows[0].status === "connected";
  const capabilities = accountResult.rows[0].capabilities as Record<string, unknown> | null;
  // Draft creation is an explicitly authorized write. Saving to the
  // connected provider's Drafts folder is part of that write, not sending.
  // The durable queue flag is committed with the draft in one transaction.
  const syncStatus = connected && capabilities?.drafts === true ? "queued" : "local_only";
  let replyThreadId:string|null=null;
  let inReplyTo:string|null=null;
  let referencesHeader:string|null=null;
  if(input.replyToMessageId){
    const sourceResult=await client.query<Row>(
      `SELECT m.thread_id,m.internet_message_id,m.references_header FROM email_messages m
       JOIN email_threads t ON t.id=m.thread_id AND t.email_account_id=m.email_account_id AND t.organization_id=m.organization_id
       WHERE m.id=$1 AND m.organization_id=$2 AND m.email_account_id=$3 AND m.is_draft=false
         AND m.provider_message_id IS NOT NULL AND m.provider_message_id NOT LIKE 'local-draft:%' FOR SHARE OF m,t`,
      [input.replyToMessageId,input.organizationId,input.emailAccountId]);
    const source=sourceResult.rows[0];if(!source)throw Error('Reply source is unavailable in the selected mailbox');
    inReplyTo=replyMessageId(source.internet_message_id);
    referencesHeader=replyReferences(source.references_header,inReplyTo);
    replyThreadId=String(source.thread_id);
  }
  const threadResult = replyThreadId?{rows:[{id:replyThreadId}]}:await client.query<Row>(
    `INSERT INTO email_threads (email_account_id, organization_id, subject, normalized_subject, participant_emails)
     VALUES ($1, $2, $3, lower(regexp_replace(coalesce($3,''), '^([[:space:]]*(re|fwd):[[:space:]]*)+', '', 'gi')), $4::citext[])
     RETURNING id`,
    [input.emailAccountId, input.organizationId, input.subject?.trim() || null, [...input.to, String(accountResult.rows[0].email_address)]],
  );
  const threadId = String(requiredRow(threadResult.rows[0], "draft thread").id);
  const messageResult = await client.query<Row>(
    `INSERT INTO email_messages
      (email_account_id, organization_id, thread_id, provider_message_id, from_email, to_recipients, cc_recipients, bcc_recipients, subject, text_body, snippet, is_read, is_draft, is_sent, received_at, provider_draft_sync_status, in_reply_to, references_header)
     VALUES ($1, $2, $3, 'local-draft:' || gen_random_uuid()::text, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, left($9, 240), true, true, false, now(), $10, $11, $12)
     RETURNING id, thread_id, email_account_id, from_email, to_recipients, cc_recipients, bcc_recipients, subject, text_body, is_draft, provider_draft_sync_status, in_reply_to, references_header, updated_at`,
    [input.emailAccountId, input.organizationId, threadId, accountResult.rows[0].email_address, JSON.stringify(input.to), JSON.stringify(input.cc ?? []), JSON.stringify(input.bcc ?? []), input.subject?.trim() || null, signedBody, syncStatus, inReplyTo, referencesHeader],
  );
  return requiredRow(messageResult.rows[0], "draft message");
  });
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
  // A zero-column PATCH is not a read operation. Returning the generic
  // message here could expose non-draft mail to an email.write-only caller.
  if (!sets.length) return null;
  values.push(messageId, organizationId);
  const draftIdParam = "$" + (values.length - 1);
  const organizationParam = "$" + values.length;
  return withTransaction(async client => {
  // Take the same draft-first lock as proposal creation. A separate UPDATE
  // statement then observes any review committed while this lock waited.
  const locked = await client.query('SELECT id FROM email_messages WHERE id=$1 AND organization_id=$2 AND is_draft=true FOR UPDATE',[messageId,organizationId]);
  if(!locked.rows.length)return null;
  if(input.bodyText!==undefined){
    const signatureRow=await client.query<Row>(`SELECT a.connection_config->>'mailSignatureText' AS mail_signature
      FROM email_messages m JOIN email_accounts a ON a.id=m.email_account_id AND a.organization_id=m.organization_id
      WHERE m.id=$1 AND m.organization_id=$2 AND a.deleted_at IS NULL`,[messageId,organizationId]);
    if(!signatureRow.rows[0])return null;
    const signed=applyMailboxSignature(input.bodyText,signatureRow.rows[0].mail_signature);
    if(signed.length>100000)throw Error("Draft body including the saved signature exceeds 100000 characters.");
    // bodyText was appended before the positional id + organization parameters.
    const bodyIndex=sets.findIndex(set=>set.startsWith("text_body = "));
    if(bodyIndex>=0)values[bodyIndex]=signed;
  }
  const r = await client.query<Row>(
    `UPDATE email_messages m SET ${sets.join(", ")}, provider_draft_sync_status = CASE
       WHEN m.provider_draft_sync_status IN ('syncing','error') THEN 'error'
       WHEN a.status = 'connected' AND a.capabilities->>'drafts' = 'true' THEN 'queued'
       ELSE 'local_only' END,
       provider_draft_sync_token = NULL,
       provider_draft_last_error = CASE WHEN m.provider_draft_sync_status IN ('syncing','error')
         THEN 'A previous provider update may have completed. Review the remote draft before retrying.'
         ELSE NULL END, updated_at = now()
     FROM email_accounts a
     WHERE m.id = ${draftIdParam} AND m.organization_id = ${organizationParam} AND m.email_account_id = a.id AND a.organization_id = ${organizationParam} AND m.is_draft = true AND a.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM email_actions ea
         WHERE ea.organization_id = m.organization_id
           AND ea.draft_id = m.id
           AND ea.email_account_id = m.email_account_id
           AND ea.action_type = 'send_email'
           AND (
             ea.status IN ('executing', 'completed')
             OR (ea.status = 'failed' AND ea.result->>'providerOutcomeUnknown' = 'true')
             OR (
               ea.status IN ('pending_approval', 'approved')
               AND (ea.expires_at IS NULL OR ea.expires_at > now())
             )
           )
       )
     RETURNING m.*`,
    values,
  );
  return r.rows[0] ?? null;
  });
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

/** Queue legacy/local-only drafts automatically when a connected account supports
 * remote drafts. Never replay an error or interrupted provider mutation:
 * its outcome may be unknown and retry could create a duplicate remote draft.
 * Both the selection and state transition are bounded, tenant-checked and
 * idempotent across concurrent worker instances.
 */
export async function queueEligibleLocalDraftsForProviderSync(limit = 25): Promise<number> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const r = await query<Row>(
    `WITH eligible AS (
       SELECT m.id FROM email_messages m
       JOIN email_accounts a ON a.id = m.email_account_id
         AND a.organization_id = m.organization_id
       WHERE m.is_draft = true AND m.provider_draft_sync_status = 'local_only'
         AND m.provider_draft_sync_token IS NULL
         AND a.status = 'connected' AND a.deleted_at IS NULL
         AND a.capabilities->>'drafts' = 'true'
         AND NOT EXISTS (
           SELECT 1 FROM email_actions ea
           WHERE ea.organization_id = m.organization_id AND ea.draft_id = m.id
             AND ea.email_account_id = m.email_account_id AND ea.action_type = 'send_email'
             AND (ea.status IN ('executing', 'completed')
               OR (ea.status = 'failed' AND ea.result->>'providerOutcomeUnknown' = 'true')
               OR (ea.status IN ('pending_approval', 'approved')
                   AND (ea.expires_at IS NULL OR ea.expires_at > now())))
         )
       ORDER BY m.updated_at ASC LIMIT $1
       FOR UPDATE OF m SKIP LOCKED
     )
     UPDATE email_messages m
       SET provider_draft_sync_status = 'queued', provider_draft_last_error = NULL,
           updated_at = now()
       FROM eligible WHERE m.id = eligible.id
         AND m.is_draft = true AND m.provider_draft_sync_status = 'local_only'
       RETURNING m.id`,
    [safeLimit],
  );
  return r.rows.length;
}

export async function listDraftsPendingProviderSync(limit = 25): Promise<Array<{ id: string; organization_id: string }>> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const r = await query<Row>(
    `SELECT m.id, m.organization_id
     FROM email_messages m
     JOIN email_accounts a ON a.id = m.email_account_id
       AND a.organization_id = m.organization_id
     WHERE m.is_draft = true
       AND m.provider_draft_sync_status = 'queued'
       AND a.status = 'connected' AND a.deleted_at IS NULL
     ORDER BY m.updated_at ASC
     LIMIT $1`,
    [safeLimit],
  );
  return r.rows.map(row => ({ id: String(row.id), organization_id: String(row.organization_id) }));
}

/** Only an explicit user action queues remote draft synchronization. */
export async function queueLocalDraftProviderSyncForOrganization(organizationId: string, messageId: string) {
  const r = await query<Row>(
    `UPDATE email_messages m
     SET provider_draft_sync_status = 'queued',
         provider_draft_sync_token = NULL, provider_draft_last_error = NULL, updated_at = now()
     FROM email_accounts a
     WHERE m.id = $1 AND m.organization_id = $2 AND m.email_account_id = a.id
       AND a.organization_id = $2 AND a.status = 'connected' AND a.deleted_at IS NULL AND m.is_draft = true
       AND m.provider_draft_sync_status IN ('local_only', 'synced', 'error')
       AND NOT EXISTS (
         SELECT 1 FROM email_actions ea
         WHERE ea.organization_id = m.organization_id AND ea.draft_id = m.id
           AND ea.email_account_id = m.email_account_id AND ea.action_type = 'send_email'
           AND (ea.status IN ('executing', 'completed')
             OR (ea.status = 'failed' AND ea.result->>'providerOutcomeUnknown' = 'true')
                OR (ea.status IN ('pending_approval', 'approved')
                    AND (ea.expires_at IS NULL OR ea.expires_at > now())))
       )
     RETURNING m.*`,
    [messageId, organizationId],
  );
  return r.rows[0] ?? null;
}

/** At most one worker wins a queued draft, obtaining its immutable attempt token
 * and the current row contents atomically. */
async function withReplyProviderThread(row:Row|null):Promise<Row|null>{
  if(!row?.in_reply_to)return row;
  const thread=await query<Row>('SELECT provider_thread_id FROM email_threads WHERE id=$1 AND organization_id=$2 AND email_account_id=$3',[row.thread_id,row.organization_id,row.email_account_id]);
  if(!thread.rows[0])throw Error('Original reply thread is unavailable');
  return {...row,reply_provider_thread_id:thread.rows[0].provider_thread_id};
}

export async function claimQueuedProviderDraftSyncForOrganization(organizationId: string, messageId: string) {
  const r = await query<Row>(
    `UPDATE email_messages m
     SET provider_draft_sync_status = 'syncing',
         provider_draft_sync_token = gen_random_uuid(), provider_draft_last_error = NULL, updated_at = now()
     FROM email_accounts a
     WHERE m.id = $1 AND m.organization_id = $2 AND m.email_account_id = a.id
       AND a.organization_id = $2 AND a.status = 'connected' AND a.deleted_at IS NULL AND m.is_draft = true
       AND m.provider_draft_sync_status = 'queued'
       AND NOT EXISTS (
         SELECT 1 FROM email_actions ea
         WHERE ea.organization_id = m.organization_id AND ea.draft_id = m.id
           AND ea.email_account_id = m.email_account_id AND ea.action_type = 'send_email'
           AND (ea.status IN ('executing', 'completed')
             OR (ea.status = 'failed' AND ea.result->>'providerOutcomeUnknown' = 'true')
                OR (ea.status IN ('pending_approval', 'approved')
                    AND (ea.expires_at IS NULL OR ea.expires_at > now())))
       )
     RETURNING m.*`,
    [messageId, organizationId],
  );
  return withReplyProviderThread(r.rows[0] ?? null);
}

export async function markDraftProviderSyncedForOrganization(
  organizationId: string,
  messageId: string,
  providerDraftId: string,
  lease: string,
) {
  const r = await query<Row>(
    `UPDATE email_messages m
     SET provider_draft_id = $1, provider_draft_sync_status = 'synced',
         provider_draft_sync_token = NULL, provider_draft_synced_at = now(), provider_draft_last_error = NULL, updated_at = now()
     FROM email_accounts a
     WHERE m.id = $2 AND m.organization_id = $3 AND m.email_account_id = a.id
       AND a.organization_id = $3 AND a.deleted_at IS NULL AND m.is_draft = true
       AND m.provider_draft_sync_status = 'syncing' AND m.provider_draft_sync_token = $4::uuid
     RETURNING m.*`,
    [providerDraftId, messageId, organizationId, lease],
  );
  return r.rows[0] ?? null;
}

export async function markDraftProviderSyncErrorForOrganization(
  organizationId: string,
  messageId: string,
  error: string,
  lease: string,
) {
  const r = await query<Row>(
    `UPDATE email_messages m
     SET provider_draft_sync_status = 'error', provider_draft_last_error = left($1, 2000),
         provider_draft_sync_token = NULL, updated_at = now()
     FROM email_accounts a
     WHERE m.id = $2 AND m.organization_id = $3 AND m.email_account_id = a.id
       AND a.organization_id = $3 AND a.deleted_at IS NULL AND m.is_draft = true
       AND m.provider_draft_sync_status = 'syncing' AND m.provider_draft_sync_token = $4::uuid
     RETURNING m.*`,
    [error, messageId, organizationId, lease],
  );
  return r.rows[0] ?? null;
}

/** Interrupted attempts are held for manual requeue rather than automatically
 * replaying an unknown provider mutation. */
export async function recoverStaleProviderDraftSyncs(maxAgeMinutes = 30) {
  const age = Math.min(Math.max(Math.floor(maxAgeMinutes), 5), 1440);
  const r = await query<Row>(
    `UPDATE email_messages m
     SET provider_draft_sync_status = 'error', provider_draft_sync_token = NULL,
         provider_draft_last_error = 'Provider draft sync timed out; review and requeue manually.',
         updated_at = now()
     FROM email_accounts a
     WHERE m.email_account_id = a.id AND a.organization_id = m.organization_id
       AND m.is_draft = true AND m.provider_draft_sync_status = 'syncing'
       AND m.updated_at < now() - make_interval(mins => $1)
     RETURNING m.id`,
    [age],
  );
  return r.rows.length;
}


export async function getLocalDraftForOrganization(organizationId: string, messageId: string) {
  const r = await query<Row>(
    `SELECT m.*, a.email_address AS account_email, a.display_name AS account_name
     FROM email_messages m JOIN email_accounts a ON a.id = m.email_account_id
     WHERE m.id = $1 AND m.organization_id = $2 AND a.organization_id = $2 AND a.deleted_at IS NULL AND m.is_draft = true
     LIMIT 1`,
    [messageId, organizationId],
  );
  return withReplyProviderThread(r.rows[0] ?? null);
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
       AND a.organization_id = $3 AND a.deleted_at IS NULL AND m.is_draft = true
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
       AND NOT EXISTS (
         SELECT 1 FROM email_actions ea
         WHERE ea.organization_id = m.organization_id
           AND ea.draft_id = m.id
           AND ea.email_account_id = m.email_account_id
           AND ea.action_type = 'send_email'
           AND (
             ea.status IN ('executing', 'completed')
             OR (ea.status = 'failed' AND ea.result->>'providerOutcomeUnknown' = 'true')
             OR (
               ea.status IN ('pending_approval', 'approved')
               AND (ea.expires_at IS NULL OR ea.expires_at > now())
             )
           )
       )
     RETURNING m.id`,
    [messageId, organizationId],
  );
  return r.rows.length > 0;
}


/** A page of real persisted email threads in the selected organization. */
export interface MailThreadFilters {
  accountId?: string;
  search?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function listMailThreadsForOrganization(
  organizationId: string,
  filters: MailThreadFilters = {},
): Promise<{ threads: Array<Record<string, unknown>>; hasMore: boolean }> {
  // Only the caller's organization can contribute messages. No preview body,
  // secret, or credential content is returned to the list UI.
  const limit = Number.isInteger(filters.limit) ? Math.min(Math.max(filters.limit!, 1), 50) : 25;
  const offset = Number.isInteger(filters.offset) ? Math.min(Math.max(filters.offset!, 0), 10000) : 0;
  const search = filters.search?.trim().slice(0, 120) || null;
  const result = await query<Row>(
    `WITH mailbox_copies AS (
      SELECT m.id,
        ROW_NUMBER() OVER (
          PARTITION BY m.email_account_id,
            CASE WHEN a.provider = 'imap_smtp' AND NULLIF(BTRIM(m.internet_message_id), '') IS NOT NULL
              THEN 'message:' || LOWER(BTRIM(m.internet_message_id))
              ELSE 'row:' || m.id::text END
          ORDER BY CASE WHEN f.role = 'inbox' OR UPPER(f.provider_folder_id) = 'INBOX' THEN 0 ELSE 1 END, m.id
        ) AS duplicate_rank
      FROM email_messages m
      JOIN email_accounts a ON a.id = m.email_account_id AND a.organization_id = $1 AND a.deleted_at IS NULL
      LEFT JOIN email_folders f ON f.id = m.folder_id AND f.email_account_id = m.email_account_id
      WHERE m.organization_id = $1 AND ($2::uuid IS NULL OR m.email_account_id = $2::uuid)
    ), scoped AS (
      SELECT
        m.thread_id,
        m.email_account_id,
        a.email_address AS account_email,
        a.display_name AS account_name,
        COALESCE(m.subject, t.subject) AS subject,
        COALESCE(m.from_name, m.from_email::text, a.email_address::text) AS sender,
        m.snippet,
        COALESCE(m.received_at, m.created_at) AS last_message_at,
        m.is_draft,
        ROW_NUMBER() OVER (
          PARTITION BY m.thread_id ORDER BY COALESCE(m.received_at, m.created_at) DESC, m.id DESC
        ) AS position,
        COUNT(*) OVER (PARTITION BY m.thread_id)::integer AS message_count,
        COUNT(*) FILTER (WHERE NOT m.is_read AND NOT m.is_draft AND NOT m.is_sent)
          OVER (PARTITION BY m.thread_id)::integer AS unread_count,
        MAX(CASE WHEN (
          $3::text IS NULL
          OR COALESCE(m.subject, t.subject, '') ILIKE '%' || $3 || '%'
          OR COALESCE(m.from_name, '') ILIKE '%' || $3 || '%'
          OR COALESCE(m.from_email::text, '') ILIKE '%' || $3 || '%'
          OR COALESCE(m.snippet, '') ILIKE '%' || $3 || '%'
          OR COALESCE(m.text_body, '') ILIKE '%' || $3 || '%'
          OR a.email_address::text ILIKE '%' || $3 || '%'
        ) THEN 1 ELSE 0 END) OVER (PARTITION BY m.thread_id) AS search_match
      FROM email_messages m
      JOIN mailbox_copies copies ON copies.id = m.id AND copies.duplicate_rank = 1
      JOIN email_accounts a ON a.id = m.email_account_id AND a.organization_id = $1 AND a.deleted_at IS NULL
      JOIN email_threads t ON t.id = m.thread_id AND t.organization_id = $1 AND t.email_account_id = a.id
      WHERE m.organization_id = $1 AND ($2::uuid IS NULL OR m.email_account_id = $2::uuid)
    )
    SELECT thread_id, email_account_id, account_email, account_name, subject, sender, snippet,
           last_message_at, is_draft, message_count, unread_count
    FROM scoped
    WHERE position = 1 AND search_match = 1 AND (NOT $4::boolean OR unread_count > 0)
    ORDER BY last_message_at DESC NULLS LAST, thread_id DESC
    LIMIT $5 OFFSET $6`,
    [organizationId, filters.accountId || null, search, filters.unreadOnly === true, limit + 1, offset],
  );
  return {
    threads: result.rows.slice(0, limit),
    hasMore: result.rows.length > limit,
  };
}
