import {
  parseCredentialsMasterKey,
  decryptCredential,
  PostgresEmailAccountRepository,
  PostgresEmailFolderLabelRepository,
  query,
} from "@ai-comms-agent/db";
import type { EmailCredentials, EmailMessage, SyncState } from "@ai-comms-agent/shared";
import { GmailAdapter } from "./gmail-adapter";
import { ZohoAdapter } from "./zoho-adapter";
import { ImapSmtpAdapter } from "./imap-smtp-adapter";
import { MicrosoftGraphAdapter } from "./microsoft-graph-adapter";
import { randomUUID } from "node:crypto";
import { acquireRedisLease, releaseRedisLease } from "./redis-lease";
import type { EmailProvider } from "@ai-comms-agent/shared";
import { publishEmailSync } from "../queues/email-sync-rabbitmq";
import { deleteEmailKnowledge } from "../knowledge/email-knowledge-indexer";
import { unavailableMessageIds, successfullyPersistedMessageIds } from "./mailbox-sync-checkpoint";
import { parseInitialImportLimit, eligibleSyncMessageIds } from "./initial-import-limit";
import type { EmailSyncPayload } from "../queues/email-sync-message";

type Candidate = {
  id: string;
  organization_id: string;
  email_address: string;
  provider: "gmail" | "zoho" | "imap_smtp" | "microsoft_graph";
  sync_cursor: string | null;
  history_id: string | null;
  last_success_at: string | null;
};

let processing = false;
const INTERVAL_MS = 10_000;
const BATCH_SIZE = 3;

async function persistMessage(account: Candidate, message: EmailMessage, providerDraftId?: string | null): Promise<void> {
  const participants = [...new Set([
    message.from_address,
    ...message.to_addresses,
    ...message.cc_addresses,
    ...message.bcc_addresses,
  ].map((address) => address.trim()).filter(Boolean))];

  const thread = await query<{ id: string }>(
    `INSERT INTO email_threads
      (email_account_id, organization_id, provider_thread_id, subject, normalized_subject,
       participant_emails, first_message_at, last_message_at, message_count, snippet, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::citext[],$7,$7,0,$8,now())
     ON CONFLICT (email_account_id, provider_thread_id) WHERE provider_thread_id IS NOT NULL
     DO UPDATE SET subject=EXCLUDED.subject,
       participant_emails=EXCLUDED.participant_emails,
       first_message_at=LEAST(COALESCE(email_threads.first_message_at, EXCLUDED.first_message_at), EXCLUDED.first_message_at),
       last_message_at=GREATEST(COALESCE(email_threads.last_message_at, EXCLUDED.last_message_at), EXCLUDED.last_message_at),
       snippet=EXCLUDED.snippet, updated_at=now()
     RETURNING id`,
    [
      account.id,
      account.organization_id,
      message.thread_id || message.provider_message_id || message.id,
      message.subject || "",
      (message.subject || "").trim().toLowerCase(),
      participants,
      message.received_at,
      message.snippet || "",
    ],
  );
  const threadId = thread.rows[0]?.id;
  if (!threadId) throw new Error("Could not persist the email message thread.");

  const labels = message.folder_id ? [message.folder_id] : [];
  const folder = await query<{ id: string }>(
    `SELECT id FROM email_folders
     WHERE email_account_id=$1 AND provider_folder_id = ANY($2::text[])
     ORDER BY CASE WHEN provider_folder_id='INBOX' THEN 0 ELSE 1 END
     LIMIT 1`,
    [account.id, labels],
  );
  const folderId = folder.rows[0]?.id ?? null;

  await query(
    `INSERT INTO email_messages
      (email_account_id, organization_id, thread_id, folder_id, provider_message_id,
       internet_message_id, in_reply_to, references_header, from_email, from_name, to_recipients,
       cc_recipients, bcc_recipients, subject, text_body, html_body_sanitized, snippet,
       headers, labels, is_read, is_starred, is_draft, is_sent, importance_score,
       action_required, received_at, sent_at, provider_updated_at, updated_at, has_attachments)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,
       '{}'::jsonb,$18::jsonb,$19,$20,$21,$22,$23,$24,$25,$26,NULL,now(),$27)
     ON CONFLICT (email_account_id, provider_message_id)
     DO UPDATE SET
       indexed_at = CASE
         WHEN email_messages.thread_id IS DISTINCT FROM EXCLUDED.thread_id
           OR email_messages.folder_id IS DISTINCT FROM EXCLUDED.folder_id
           OR email_messages.from_email IS DISTINCT FROM EXCLUDED.from_email
           OR email_messages.from_name IS DISTINCT FROM EXCLUDED.from_name
           OR email_messages.to_recipients IS DISTINCT FROM EXCLUDED.to_recipients
           OR email_messages.cc_recipients IS DISTINCT FROM EXCLUDED.cc_recipients
           OR email_messages.bcc_recipients IS DISTINCT FROM EXCLUDED.bcc_recipients
           OR email_messages.subject IS DISTINCT FROM EXCLUDED.subject
           OR email_messages.text_body IS DISTINCT FROM EXCLUDED.text_body
           OR email_messages.snippet IS DISTINCT FROM EXCLUDED.snippet
           OR email_messages.labels IS DISTINCT FROM EXCLUDED.labels
           OR email_messages.is_read IS DISTINCT FROM EXCLUDED.is_read
           OR email_messages.is_starred IS DISTINCT FROM EXCLUDED.is_starred
           OR email_messages.is_draft IS DISTINCT FROM EXCLUDED.is_draft
           OR email_messages.is_sent IS DISTINCT FROM EXCLUDED.is_sent
           OR email_messages.importance_score IS DISTINCT FROM EXCLUDED.importance_score
           OR email_messages.action_required IS DISTINCT FROM EXCLUDED.action_required
           OR email_messages.received_at IS DISTINCT FROM EXCLUDED.received_at
           OR email_messages.sent_at IS DISTINCT FROM EXCLUDED.sent_at
           OR email_messages.has_attachments IS DISTINCT FROM EXCLUDED.has_attachments
         THEN NULL ELSE email_messages.indexed_at END,
       thread_id=EXCLUDED.thread_id, folder_id=EXCLUDED.folder_id,
       internet_message_id=EXCLUDED.internet_message_id, in_reply_to=EXCLUDED.in_reply_to,
       references_header=EXCLUDED.references_header, from_email=EXCLUDED.from_email,
       from_name=EXCLUDED.from_name,
       to_recipients=EXCLUDED.to_recipients, cc_recipients=EXCLUDED.cc_recipients,
       bcc_recipients=EXCLUDED.bcc_recipients, subject=EXCLUDED.subject,
       text_body=EXCLUDED.text_body, html_body_sanitized=EXCLUDED.html_body_sanitized,
       snippet=EXCLUDED.snippet, labels=EXCLUDED.labels,
       is_read=EXCLUDED.is_read, is_starred=EXCLUDED.is_starred, is_draft=EXCLUDED.is_draft,
       is_sent=EXCLUDED.is_sent, importance_score=EXCLUDED.importance_score,
       action_required=EXCLUDED.action_required, received_at=EXCLUDED.received_at,
       sent_at=EXCLUDED.sent_at, has_attachments=EXCLUDED.has_attachments,
       updated_at=now()`,
    [
      account.id,
      account.organization_id,
      threadId,
      folderId,
      message.provider_message_id || message.id,
      message.message_id_header || null,
      message.in_reply_to || null,
      (message.references ?? []).join(" ") || null,
      message.from_address || null,
      message.from_name || null,
      JSON.stringify(message.to_addresses ?? []),
      JSON.stringify(message.cc_addresses ?? []),
      JSON.stringify(message.bcc_addresses ?? []),
      message.subject || "",
      message.text_body || "",
      message.html_body || null,
      message.snippet || "",
      JSON.stringify(labels),
      message.is_read,
      message.is_starred,
      message.is_draft,
      message.is_outbound,
      message.importance_score,
      message.action_required,
      message.received_at,
      message.is_outbound ? message.received_at : null,
      Boolean(message.has_attachments),
    ],
  );

  await query(
    `UPDATE email_threads SET
       message_count=(SELECT count(*) FROM email_messages WHERE thread_id=$1),
       updated_at=now()
     WHERE id=$1`,
    [threadId],
  );

  if (message.is_draft && providerDraftId) {
    await query(
      `UPDATE email_messages SET provider_draft_id=$1,
         provider_draft_sync_status='synced', provider_draft_synced_at=now(),
         provider_draft_last_error=NULL, updated_at=now()
       WHERE email_account_id=$2 AND provider_message_id=$3 AND is_draft=true`,
      [providerDraftId, account.id, message.provider_message_id || message.id],
    );
  }

  // NOTE: RAG indexing is intentionally NOT done inline here. The
  // persistMessage path runs inside the Gmail/Zoho/IMAP sync loop, which
  // needs to stay fast so we don't stall on per-message chunking +
  // knowledge_chunks INSERTs while the provider rate-limit clock is
  // running. The new email_messages.indexed_at column (migration 0045)
  // is NULL on insert; a separate worker tick
  // (processEmailKnowledgeIndexingBatch in apps/worker/src/knowledge/)
  // selects messages where indexed_at IS NULL and runs chunking +
  // knowledge_documents / knowledge_chunks INSERTs in batched fashion.
}


/**
 * Apply provider-reported hard deletions before committing the sync cursor.
 * Provider IDs are scoped by the connected local account; never delete by
 * provider_message_id alone. A replay is safe after a worker crash.
 */
async function removeDeletedMessages(account: Candidate, providerMessageIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(providerMessageIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (uniqueIds.length === 0) return;

  const removed = await query<{ thread_id: string | null; provider_message_id: string }>(
    `DELETE FROM email_messages
     WHERE email_account_id = $1
       AND organization_id = $2
       AND provider_message_id = ANY($3::text[])
     RETURNING thread_id, provider_message_id`,
    [account.id, account.organization_id, uniqueIds],
  );

  const affectedThreads = [...new Set(removed.rows.map((row) => row.thread_id).filter((id): id is string => Boolean(id)))];
  for (const threadId of affectedThreads) {
    await query(
      `UPDATE email_threads SET
         message_count=(SELECT count(*) FROM email_messages WHERE thread_id=$1),
         updated_at=now()
       WHERE id=$1 AND email_account_id=$2 AND organization_id=$3`,
      [threadId, account.id, account.organization_id],
    );
  }

  // Remove derived retrieval documents even when the local message row was
  // already absent (e.g. a retry after a partial failure).
  await Promise.all(uniqueIds.map((id) => deleteEmailKnowledge(account.organization_id, account.id, id, account.provider)));
}

async function processAccount(candidate: Candidate): Promise<boolean> {
  const claimed = await query<{
    cursor: string | null;
    history_id: string | null;
    last_success_at: string | null;
    sync_mode: string | null;
    pending_message_ids: string[] | null;
    pending_cursor_token: string | null;
    pending_history_id: string | null;
    pending_sync_mode: string | null;
    pending_push_at: string | null;
    last_attempt_at: string | null;
  }>(
    `INSERT INTO email_sync_states
      (email_account_id, organization_id, status, last_attempt_at, updated_at)
     VALUES ($1,$2,'running',now(),now())
     ON CONFLICT (email_account_id) DO UPDATE
       SET status='running', last_attempt_at=now(), updated_at=now()
       WHERE email_sync_states.status <> 'running'
          OR email_sync_states.last_attempt_at < now()-interval '10 minutes'
     RETURNING cursor_token AS cursor, history_id, last_success_at, sync_mode,
       pending_message_ids, pending_cursor_token, pending_history_id, pending_sync_mode,
       pending_push_at, last_attempt_at`,
    [candidate.id, candidate.organization_id],
  );
  if (!claimed.rows[0]) return false;

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "worker.email-sync",
    message: "Mailbox sync claim acquired",
    organization_id: candidate.organization_id,
    account_id: candidate.id,
    provider: candidate.provider,
    sync_mode: claimed.rows[0].sync_mode ?? "initial",
  }));

  const accounts = new PostgresEmailAccountRepository();
  const adapter: EmailProvider & { getCredentialSnapshot?: () => EmailCredentials; listDraftIdsByMessage?: () => Promise<Map<string, string>> } = candidate.provider === "gmail" ? new GmailAdapter() : candidate.provider === "zoho" ? new ZohoAdapter() : candidate.provider === "microsoft_graph" ? new MicrosoftGraphAdapter() : new ImapSmtpAdapter();

  try {
    const masterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
    if (!masterKey) throw new Error("CREDENTIALS_MASTER_KEY is required for mailbox synchronization.");
    const stored = await accounts.loadCredentials(candidate.id, parseCredentialsMasterKey(masterKey));
    if (!stored) throw new Error("Encrypted mailbox credentials are missing. Reconnect this mailbox.");

    // Load the account's connection_config — it contains provider-specific
    // settings that aren't stored in the encrypted credentials (e.g., Zoho's
    // api_domain, Gmail's historyId/oauthConfigId). Merge these into the
    // credentials object before passing to the adapter.
    const accountRow = await query<{ connection_config: Record<string, unknown> | null }>(
      "SELECT connection_config FROM email_accounts WHERE id = $1",
      [candidate.id],
    );
    const connectionConfig = (accountRow.rows[0]?.connection_config ?? {}) as Record<string, unknown>;

    // Map camelCase connection_config keys to the snake_case format expected
    // by the provider adapters. The Zoho callback stores "apiDomain" but
    // the ZohoAdapter reads "api_domain".
    if (connectionConfig.apiDomain && !connectionConfig.api_domain) {
      connectionConfig.api_domain = connectionConfig.apiDomain;
    }
    if (connectionConfig.dataCenter && !connectionConfig.data_center) {
      connectionConfig.data_center = connectionConfig.dataCenter;
    }
    if (connectionConfig.remoteAccountId && !connectionConfig.remote_account_id) {
      connectionConfig.remote_account_id = connectionConfig.remoteAccountId;
    }

    const credentials: EmailCredentials = {
      ...(stored as unknown as EmailCredentials),
      // Merge connection_config fields into credentials. For Zoho, this
      // provides api_domain. For Gmail, this provides historyId/oauthScope.
      ...connectionConfig,
      credential_type: candidate.provider === "imap_smtp" ? ((stored as unknown as EmailCredentials).credential_type ?? "app_password") : "oauth_token",
    };
    if (candidate.provider === "microsoft_graph") {
      // Rotation of Microsoft OAuth client secrets happens in Platform
      // Settings, without an application rebuild or mailbox reconnect.
      // Reject missing/disabled client references instead of falling back to
      // stale tokens or deployment environment variables.
      const configId = typeof connectionConfig.oauthConfigId === "string" ? connectionConfig.oauthConfigId : "";
      if (!configId) throw new Error("This Outlook mailbox must be reconnected to a Microsoft OAuth client from Platform Settings.");
      const oauth = await query<{ client_id: string; tenant_id: string; client_secret_ciphertext: Buffer }>(
        "SELECT client_id,tenant_id,client_secret_ciphertext FROM microsoft_oauth_configs WHERE id=$1 AND organization_id=$2 AND enabled=true LIMIT 1",
        [configId, candidate.organization_id],
      );
      const selected = oauth.rows[0];
      if (!selected) throw new Error("The Microsoft OAuth client is disabled or missing. Enable it in Platform Settings.");
      credentials.microsoft_client_id = selected.client_id;
      credentials.microsoft_tenant_id = selected.tenant_id;
      credentials.microsoft_client_secret = decryptCredential(
        selected.client_secret_ciphertext, parseCredentialsMasterKey(masterKey),
      ).toString("utf8");
    }
    await adapter.connect(credentials);
    const structure = await query<{ count: string }>(
      "SELECT count(*)::text AS count FROM email_folders WHERE email_account_id=$1",
      [candidate.id],
    );
    if (Number(structure.rows[0]?.count ?? 0) === 0) {
      const [folders, labels] = await Promise.all([
        adapter.listFolders(),
        adapter.listLabels ? adapter.listLabels() : Promise.resolve([]),
      ]);
      await new PostgresEmailFolderLabelRepository().replaceStructure(
        candidate.id,
        candidate.organization_id,
        folders,
        labels,
      );
    }

    const initialLimit = parseInitialImportLimit(connectionConfig.initialSyncLimit);
    const imported = await query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM email_messages WHERE organization_id=$1 AND email_account_id=$2",
      [candidate.organization_id, candidate.id],
    );
    const importedCount = Number(imported.rows[0]?.count ?? 0);
    const state: SyncState = {
      initial_message_limit: initialLimit,
      initial_imported_count: importedCount,
      cursor: claimed.rows[0].cursor ?? undefined,
      history_token: claimed.rows[0].history_id ?? undefined,
      last_sync_at: claimed.rows[0].last_success_at ?? new Date(0).toISOString(),
      // Use the DB's sync_mode column directly. The old computation
      // `cursor || !history_id ? 'initial' : 'incremental'` was WRONG because
      // the first sync cycle sets history_id (from the Gmail profile) but
      // doesn't set cursor (no pageToken yet). The computation then evaluates
      // to 'incremental' → the worker calls the History API → gets 0 changes
      // → imports 0 messages. The initial import NEVER runs.
      //
      // By using the DB column directly, when we set sync_mode='initial'
      // (either via a fresh account or via a manual reset), the worker
      // correctly enters the initial path (messages.list) and pages through
      // ALL messages. When the adapter returns sync_mode='incremental' (no
      // more pages), the completion UPDATE sets sync_mode='incremental' in
      // the DB, and future syncs correctly use the History API.
      sync_mode: (claimed.rows[0].sync_mode ?? "initial") as "initial" | "incremental",
    };

    // Stage each provider page durably before fetching full messages. If Gmail
    // throttles midway, the next attempt resumes the remaining IDs rather than
    // listing and fetching the same page again.
    let stagedCursor = claimed.rows[0].pending_cursor_token;
    let stagedHistory = claimed.rows[0].pending_history_id;
    let stagedMode = claimed.rows[0].pending_sync_mode;
    let ids: string[];
    let providerDeleted: string[] = [];
    if (stagedMode !== null && stagedMode !== undefined) {
      ids = Array.isArray(claimed.rows[0].pending_message_ids) ? claimed.rows[0].pending_message_ids : [];
    } else {
      const result = await adapter.sync(state);
      const messageIds = new Set([
        ...result.added.map((item) => item.provider_message_id),
        ...result.updated.map((item) => item.provider_message_id),
      ]);
      // Historical import is a one-time, configurable snapshot. Do not
      // discard *incremental* events, including live incoming messages.
      // Providers without a direct history cursor may still scan older
      // metadata to establish their checkpoint; do not persist the backlog.
      ids = eligibleSyncMessageIds([...messageIds], state.sync_mode, initialLimit, importedCount);
      stagedCursor = result.new_state.cursor ?? null;
      stagedHistory = result.new_state.history_token ?? null;
      stagedMode = result.new_state.sync_mode;
      providerDeleted = result.deleted;
      await query(
        `UPDATE email_sync_states SET pending_message_ids=$1::jsonb,
           pending_cursor_token=$2, pending_history_id=$3, pending_sync_mode=$4,
           updated_at=now()
         WHERE email_account_id=$5`,
        [JSON.stringify(ids), stagedCursor, stagedHistory, stagedMode, candidate.id],
      );
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        service: "worker.email-sync",
        message: "Mailbox sync message IDs staged",
        organization_id: candidate.organization_id,
        account_id: candidate.id,
        provider: candidate.provider,
        pending_count: ids.length,
      }));
    }

    const refreshedCredentials = adapter.getCredentialSnapshot?.();
    if (refreshedCredentials && (
      refreshedCredentials.access_token !== credentials.access_token ||
      refreshedCredentials.expires_at !== credentials.expires_at
    )) {
      await accounts.saveCredentials(
        candidate.id,
        "oauth_token",
        { ...refreshedCredentials },
        parseCredentialsMasterKey(masterKey),
      );
    }

    let saved = 0;
    let draftIdsByMessage: Map<string, string> | undefined;

    // ─── Batched fetch + persist ────────────────────────────────────────
    // Old loop: one HTTP request per message ID + 250ms throttle = ~4
    // messages/sec. New loop: Gmail batch endpoint fetches 100 messages
    // per HTTP request; Zoho/IMAP fall back to Promise.all concurrency
    // of 10. Persistence is parallel via Promise.all too. After each
    // batch, we update the pending_message_ids checkpoint in one UPDATE.
    const isGmail = candidate.provider === "gmail";
    // BATCH_FETCH_SIZE controls the HTTP fetch batch (Gmail batch endpoint
    // caps at 100; Zoho/IMAP have no batch endpoint so they fall back to
    // Promise.all of PERSIST_CONCURRENCY at a time).
    // PERSIST_CONCURRENCY must stay BELOW DATABASE_POOL_MAX (default 10,
    // user-set 5 on Supabase transaction-mode pooler) — otherwise the local
    // pg Pool throws ECHECKOUTTIMEOUT when all 5 connections are in use.
    // We use 4 for Gmail (leaves headroom for indexer/scheduler/whatsapp
    // ticks that may run concurrently) and 3 for Zoho/IMAP (which also
    // does an HTTP fetch per ID, so the persist path is the only DB pressure).
    // Stage IMAP UIDs cheaply, then persist five bodies at a time so large
    // mailboxes show durable progress rather than remaining at 0/50.
    const BATCH_FETCH_SIZE = isGmail ? 50 : candidate.provider === "imap_smtp" ? 5 : 25;
    const PERSIST_CONCURRENCY = isGmail ? 4 : 3;         // DB write concurrency
    const failedPersistIds = new Set<string>();
    const persistMessageSafe = async (id: string, message: EmailMessage | null): Promise<boolean> => {
      if (!message) return false;
      if (message.is_draft && !draftIdsByMessage && adapter.listDraftIdsByMessage) {
        draftIdsByMessage = await adapter.listDraftIdsByMessage();
      }
      const providerDraftId = message.is_draft
        ? draftIdsByMessage?.get(message.provider_message_id || message.id) ?? (candidate.provider === "zoho" ? (message.provider_message_id || message.id) : null)
        : null;
      try {
        await persistMessage(candidate, message, providerDraftId);
        saved += 1;
        return true;
      } catch (persistError) {
        // Keep failed IDs in the durable pending list. Advancing the cursor
        // after a failed DB write silently loses mail from the local inbox.
        failedPersistIds.add(id);
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          service: "worker.email-sync.persist",
          message: "Persist failed for message; preserving checkpoint for retry",
          account_id: candidate.id,
          provider_message_id: id,
          reason: persistError instanceof Error ? persistError.message : "Unknown error",
        }));
        return false;
      }
    };

    for (let batchStart = 0; batchStart < ids.length; batchStart += BATCH_FETCH_SIZE) {
      const batchIds = ids.slice(batchStart, batchStart + BATCH_FETCH_SIZE);
      const messages: Array<{ id: string; message: EmailMessage | null }> = [];
      const failedFetchIds = new Set<string>();

      if (isGmail && typeof (adapter as any).batchGetMessages === "function") {
        // Gmail: 1 HTTP request per 100 IDs.
        const batchMap = await (adapter as any).batchGetMessages(batchIds) as Map<string, EmailMessage>;
        for (const id of batchIds) {
          messages.push({ id, message: batchMap.get(id) ?? null });
        }
      } else {
        // A single IMAP TLS socket cannot safely interleave SELECT/FETCH command replies.
        // Keep Zoho parallelism, but issue each IMAP getMessage sequentially.
        const concurrency = candidate.provider === "imap_smtp" ? 1 : PERSIST_CONCURRENCY;
        for (let i = 0; i < batchIds.length; i += concurrency) {
          const slice = batchIds.slice(i, i + concurrency);
          const settled = await Promise.all(
            slice.map(async (id) => {
              try {
                return { id, message: await adapter.getMessage(id) };
              } catch (getError) {
                failedFetchIds.add(id);
                console.error(JSON.stringify({
                  timestamp: new Date().toISOString(),
                  level: "error",
                  service: "worker.email-sync.fetch",
                  message: "Single-message fetch failed; will retry on next sync",
                  account_id: candidate.id,
                  provider_message_id: id,
                  reason: getError instanceof Error ? getError.message : "Unknown error",
                }));
                return { id, message: null };
              }
            }),
          );
          messages.push(...settled);
        }
      }

      // Persist messages with bounded concurrency.
      // Sequential chunks of PERSIST_CONCURRENCY so we don't blow the
      // Postgres connection pool (DATABASE_POOL_MAX=5 with Supabase
      // transaction-mode pooler).
      for (let i = 0; i < messages.length; i += PERSIST_CONCURRENCY) {
        const slice = messages.slice(i, i + PERSIST_CONCURRENCY);
        const persisted = await Promise.all(slice.map((entry) => persistMessageSafe(entry.id, entry.message)));
        const persistedIds = successfullyPersistedMessageIds(slice, persisted);
        if (persistedIds.length > 0) {
          await query(
            `UPDATE email_sync_states
             SET pending_message_ids = COALESCE(pending_message_ids, '[]'::jsonb) - $1::text[],
                 updated_at = now()
             WHERE email_account_id=$2`,
            [persistedIds, candidate.id],
          );
        }
      }

      // Mark the un-fetched IDs (e.g., 404 from Gmail) as acked too —
      // they're gone from the server, retrying won't help.
      // A transport/command error is retryable, not proof the message vanished.
      // Never acknowledge failed IMAP/Zoho fetches or advance past their IDs.
      const missedIds = unavailableMessageIds(messages.filter((entry) => !failedFetchIds.has(entry.id)));
      if (missedIds.length > 0) {
        await query(
          `UPDATE email_sync_states
           SET pending_message_ids = COALESCE(pending_message_ids, '[]'::jsonb) - $1::text[],
               updated_at = now()
           WHERE email_account_id=$2`,
          [missedIds, candidate.id],
        );
      }
      if (candidate.provider === "imap_smtp") {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          service: "worker.email-sync",
          message: "IMAP mailbox import batch processed",
          organization_id: candidate.organization_id,
          account_id: candidate.id,
          imported_or_updated: saved,
          processed_count: Math.min(batchStart + batchIds.length, ids.length),
          staged_count: ids.length,
        }));
      }
      if (failedFetchIds.size > 0) {
        throw new Error(`Failed to fetch ${failedFetchIds.size} email message(s); pending IDs preserved for retry.`);
      }
      const failedInBatch = messages.filter((entry) => failedPersistIds.has(entry.id));
      if (failedInBatch.length > 0) {
        throw new Error(`Failed to persist ${failedInBatch.length} email message(s); pending IDs preserved for retry.`);
      }
    }

    await removeDeletedMessages(candidate, providerDeleted);

    await query(
      `UPDATE email_sync_states SET cursor_token=$1, history_id=$2, sync_mode=$5, status='idle',
         pending_message_ids='[]'::jsonb, pending_cursor_token=NULL,
         pending_history_id=NULL, pending_sync_mode=NULL,
         pending_push_at=CASE
           WHEN pending_push_at IS NOT NULL AND pending_push_at <= $4::timestamptz THEN NULL
           ELSE pending_push_at
         END,
         last_success_at=now(), last_attempt_at=now(),
         next_attempt_at=CASE
           WHEN pending_push_at IS NOT NULL AND pending_push_at > $4::timestamptz THEN now()
           ELSE NULL
         END,
         error_count=0, last_error=NULL, updated_at=now()
       WHERE email_account_id=$3`,
      [stagedCursor, stagedHistory, candidate.id, claimed.rows[0].last_attempt_at, stagedMode],
    );
    await accounts.updateSyncState(candidate.id, new Date().toISOString());
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "worker.email-sync",
      message: `${candidate.provider} mailbox synchronization completed`,
      organization_id: candidate.organization_id,
      account_id: candidate.id,
      imported_or_updated: saved,
      sync_mode: stagedMode,
      initial_import_remaining: stagedMode === "initial" && stagedCursor !== null,
    }));

    // ─── Delta catch-up after long initial sync ───────────────────────
    // An initial sync can take many minutes (Gmail quota, large archives).
    // Emails that arrived during the import are NOT picked up by the
    // initial-mode `messages.list` pagination (which is forward-only
    // from a fixed point). For Gmail, the baseline `history_id` we
    // captured at sync start is the anchor — re-running in incremental
    // mode now replays every Gmail history event since that baseline.
    // For Zoho/IMAP we run one more "incremental" pass with the
    // new history_token. The catch-up is best-effort; any error just
    // schedules a normal due-sync via next_attempt_at.
    if (stagedMode === "initial" && stagedCursor === null && stagedHistory) {
      try {
        const catchUpState: SyncState = {
          cursor: undefined,
          history_token: stagedHistory,
          last_sync_at: new Date().toISOString(),
          sync_mode: "incremental",
        };
        const delta = await adapter.sync(catchUpState);
        const deltaIds = new Set<string>([
          ...delta.added.map((item) => item.provider_message_id),
          ...delta.updated.map((item) => item.provider_message_id),
        ]);
        let deltaSaved = 0;
        for (const id of deltaIds) {
          try {
            const message = await adapter.getMessage(id);
            if (message) {
              await persistMessage(candidate, message, null);
              deltaSaved += 1;
            }
          } catch {
            // Best-effort — leave for the next scheduled sync.
          }
        }
        if (delta.deleted.length > 0) {
          await removeDeletedMessages(candidate, delta.deleted);
        }
        if (deltaIds.size > 0) {
          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "info",
            service: "worker.email-sync",
            message: `${candidate.provider} delta catch-up after initial sync`,
            organization_id: candidate.organization_id,
            account_id: candidate.id,
            delta_added_or_updated: deltaIds.size,
            delta_saved: deltaSaved,
            delta_deleted: delta.deleted.length,
          }));
        }
      } catch (catchUpError) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          service: "worker.email-sync",
          message: `${candidate.provider} delta catch-up failed; scheduling next sync`,
          organization_id: candidate.organization_id,
          account_id: candidate.id,
          reason: catchUpError instanceof Error ? catchUpError.message : "Unknown error",
        }));
        // Force a near-immediate due-sync so the regular poller picks this
        // up rather than waiting 15 minutes.
        await query(
          `UPDATE email_sync_states SET next_attempt_at=now()+interval '30 seconds',
             updated_at=now() WHERE email_account_id=$1`,
          [candidate.id],
        );
      }
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Gmail synchronization failed.";
    const revoked = /invalid_grant|no refresh token is available|refresh token.*revoked/i.test(message);
    const quotaLimited = /Gmail API (?:403|429) \(quota\/rate limit|quota exceeded|userRateLimitExceeded|rateLimitExceeded|RESOURCE_EXHAUSTED/i.test(message);
    await query(
      `UPDATE email_sync_states SET status='error', last_attempt_at=now(),
         next_attempt_at=now()+make_interval(secs => CASE
           WHEN $3::boolean THEN LEAST(21600, 300 * power(2, LEAST(error_count,6))::int)
           ELSE LEAST(3600, 60 * power(2, LEAST(error_count,5))::int)
         END),
         error_count=error_count+1, last_error=$1, updated_at=now()
       WHERE email_account_id=$2`,
      [message, candidate.id, quotaLimited],
    );
    await accounts.updateStatus(candidate.id, revoked ? "revoked" : "error", message);
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "worker.email-sync",
      message: `${candidate.provider} mailbox synchronization failed`,
      organization_id: candidate.organization_id,
      account_id: candidate.id,
      reason: message,
      status: revoked ? "revoked" : "error",
    }));
    return false;
  } finally {
    await adapter.disconnect().catch(() => undefined);
  }
}

export async function processMailboxSyncMessage(payload: EmailSyncPayload): Promise<void> {
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) {
    throw new Error("PostgreSQL and credential encryption must be configured for email sync.");
  }
  const result = await query<Candidate>(
    `SELECT a.id, a.organization_id, a.email_address, a.provider,
       s.cursor_token AS sync_cursor, s.history_id, s.last_success_at
     FROM email_accounts a
     LEFT JOIN email_sync_states s ON s.email_account_id=a.id
     WHERE a.id=$1 AND a.deleted_at IS NULL
       AND a.provider IN ('gmail','zoho','imap_smtp','microsoft_graph')
       AND a.status IN ('pending','connected','error')`,
    [payload.account_id],
  );
  const candidate = result.rows[0];
  // Deleted or disconnected accounts are terminal outcomes, not retryable failures.
  if (!candidate) return;
  const succeeded = await processAccount(candidate);
  if (succeeded) return;

  // Duplicate deliveries are expected with at-least-once queues. If another worker
  // owns a fresh PostgreSQL claim, acknowledge this delivery instead of exhausting retries.
  const state = await query<{
    status: string;
    last_attempt_at: string | null;
    next_attempt_at: string | null;
    last_error: string | null;
  }>(
    "SELECT status, last_attempt_at, next_attempt_at, last_error FROM email_sync_states WHERE email_account_id=$1",
    [candidate.id],
  );
  const current = state.rows[0];
  const activeClaim = current?.status === "running"
    && current.last_attempt_at !== null
    && Date.now() - new Date(current.last_attempt_at).getTime() < 10 * 60_000;
  if (activeClaim) return;

  // Quota failures have a durable database backoff. Ack the current RabbitMQ
  // delivery and let the due-sync poller enqueue it after that deadline rather
  // than exhausting retries every 30 seconds and sending it to the DLQ.
  const quotaDeferred = current?.status === "error"
    && /quota\/rate limit|quota exceeded|userRateLimitExceeded|rateLimitExceeded|RESOURCE_EXHAUSTED/i.test(current.last_error ?? "")
    && current.next_attempt_at !== null
    && new Date(current.next_attempt_at).getTime() > Date.now();
  if (quotaDeferred) return;
  throw new Error("Mailbox sync did not complete; retry delivery is required.");
}

async function enqueueDueMailboxSyncs(limit = BATCH_SIZE): Promise<number> {
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY || !process.env.RABBITMQ_URL) return 0;
  const result = await query<Candidate>(
    `SELECT a.id, a.organization_id, a.email_address, a.provider,
       s.cursor_token AS sync_cursor, s.history_id, s.last_success_at
     FROM email_accounts a
     LEFT JOIN email_sync_states s ON s.email_account_id=a.id
     WHERE a.provider IN ('gmail','zoho','imap_smtp','microsoft_graph') AND a.deleted_at IS NULL
       AND a.status IN ('pending','connected','error')
       AND COALESCE(s.status::text,'idle') <> 'paused'
       AND (s.next_attempt_at IS NULL OR s.next_attempt_at <= now())
       AND (s.status IS NULL OR s.status <> 'running'
         OR s.last_attempt_at < now()-interval '10 minutes')
       AND (s.last_attempt_at IS NULL OR s.last_attempt_at < now()-interval '10 seconds')
       AND (s.last_success_at IS NULL
         OR s.last_success_at < now()-interval '30 seconds'
         OR a.status IN ('pending','error')
         OR s.sync_mode = 'initial'
         OR (s.next_attempt_at IS NOT NULL AND s.next_attempt_at <= now())
         OR s.pending_push_at IS NOT NULL)
     ORDER BY CASE a.status WHEN 'pending' THEN 0 WHEN 'error' THEN 1 ELSE 2 END,
       COALESCE(s.last_success_at, a.created_at) ASC
     LIMIT $1`,
    [Math.max(1, Math.min(limit, 10))],
  );
  let enqueued = 0;
  for (const candidate of result.rows) {
    await publishEmailSync({
      account_id: candidate.id,
      history_id: candidate.history_id ?? undefined,
      triggered_by: "poll",
    });
    // Suppress repeat publication after broker confirmation; last_success_at controls the next poll.
    await query(
      `INSERT INTO email_sync_states
         (email_account_id, organization_id, status, next_attempt_at, updated_at)
       VALUES ($1,$2,'idle',now()+interval '30 seconds',now())
       ON CONFLICT (email_account_id) DO UPDATE SET
         next_attempt_at=now()+interval '30 seconds', updated_at=now()
       WHERE email_sync_states.status <> 'running'`,
      [candidate.id, candidate.organization_id],
    );
    enqueued += 1;
  }
  return enqueued;
}

export async function processMailboxSyncBatch(limit = BATCH_SIZE): Promise<{ attempted: number; succeeded: number }> {
  if (processing || !process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) {
    return { attempted: 0, succeeded: 0 };
  }
  processing = true;
  const redisUrl = process.env.REDIS_URL?.trim();
  const leaseToken = randomUUID();
  let redisLeaseAcquired = false;
  if (redisUrl) {
    try {
      redisLeaseAcquired = await acquireRedisLease(redisUrl, "ai-comms-agent:mailbox-sync:batch", leaseToken, 600_000);
    } catch (error) {
      processing = false;
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "worker.email-sync",
        message: "Redis mailbox-sync lease unavailable; batch skipped to avoid uncoordinated multi-worker polling",
        reason: error instanceof Error ? error.message : "Redis connection failed",
      }));
      return { attempted: 0, succeeded: 0 };
    }
    if (!redisLeaseAcquired) {
      processing = false;
      return { attempted: 0, succeeded: 0 };
    }
  }
  let attempted = 0;
  let succeeded = 0;
  try {
    const candidates = await query<Candidate>(
      `SELECT a.id, a.organization_id, a.email_address, a.provider,
         s.cursor_token AS sync_cursor, s.history_id, s.last_success_at
       FROM email_accounts a
       LEFT JOIN email_sync_states s ON s.email_account_id=a.id
       WHERE a.provider IN ('gmail','zoho','imap_smtp','microsoft_graph') AND a.deleted_at IS NULL
         AND a.status IN ('pending','connected','error')
         AND COALESCE(s.status::text,'idle') <> 'paused'
         AND (s.next_attempt_at IS NULL OR s.next_attempt_at <= now())
         AND (s.status IS NULL OR s.status <> 'running'
           OR s.last_attempt_at < now()-interval '10 minutes')
         AND (s.last_attempt_at IS NULL OR s.last_attempt_at < now()-interval '10 seconds')
         AND (s.last_success_at IS NULL
           OR s.last_success_at < now()-interval '2 minutes'
           OR a.status IN ('pending','error')
           OR s.sync_mode = 'initial'
         OR (s.next_attempt_at IS NOT NULL AND s.next_attempt_at <= now())
         OR s.pending_push_at IS NOT NULL)
       ORDER BY CASE a.status WHEN 'pending' THEN 0 WHEN 'error' THEN 1 ELSE 2 END,
         COALESCE(s.last_success_at, a.created_at) ASC
       LIMIT $1`,
      [Math.max(1, Math.min(limit, 10))],
    );
    for (const candidate of candidates.rows) {
      attempted += 1;
      if (await processAccount(candidate)) succeeded += 1;
    }
    return { attempted, succeeded };
  } finally {
    if (redisLeaseAcquired && redisUrl) {
      await releaseRedisLease(redisUrl, "ai-comms-agent:mailbox-sync:batch", leaseToken).catch((error) => {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          service: "worker.email-sync",
          message: "Redis mailbox-sync lease release failed; TTL will recover it",
          reason: error instanceof Error ? error.message : "Redis release failed",
        }));
      });
    }
    processing = false;
  }
}

export function startMailboxSyncLoop() {
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY || process.env.GMAIL_MAILBOX_SYNC_DISABLED === "true") {
    return () => undefined;
  }
  let stopped = false;
  const queueEnabled = Boolean(process.env.RABBITMQ_URL?.trim());
  const tick = async () => {
    if (stopped) return;
    if (!queueEnabled) {
      try {
        await processMailboxSyncBatch();
      } catch (error) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          service: "worker.email-sync",
          message: "Mailbox synchronization poll failed",
          reason: error instanceof Error ? error.message : "Unknown worker error",
        }));
      }
      return;
    }

    try {
      await enqueueDueMailboxSyncs();
    } catch (error) {
      // A configured but unavailable broker must not silently strand all mailboxes
      // in pending/queued state. Use the same leased batch processor as the
      // no-queue deployment mode; it fails closed if the Redis distributed lease
      // cannot be acquired, so this fallback does not permit uncoordinated workers.
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "worker.email-sync",
        message: "Mailbox queue producer poll failed; attempting leased direct-sync fallback",
        reason: error instanceof Error ? error.message : "Unknown queue error",
      }));
      try {
        const result = await processMailboxSyncBatch();
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: result.succeeded > 0 ? "info" : "warn",
          service: "worker.email-sync",
          message: "Leased direct-sync fallback completed",
          attempted: result.attempted,
          succeeded: result.succeeded,
        }));
      } catch (fallbackError) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          service: "worker.email-sync",
          message: "Leased direct-sync fallback failed",
          reason: fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error",
        }));
      }
    }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
