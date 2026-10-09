import {
  parseCredentialsMasterKey,
  PostgresEmailAccountRepository,
  PostgresEmailFolderLabelRepository,
  query,
} from "@ai-comms-agent/db";
import type { EmailCredentials, EmailMessage, SyncState } from "@ai-comms-agent/shared";
import { GmailAdapter } from "./gmail-adapter";
import { ZohoAdapter } from "./zoho-adapter";
import { ImapSmtpAdapter } from "./imap-smtp-adapter";
import { randomUUID } from "node:crypto";
import { acquireRedisLease, releaseRedisLease } from "./redis-lease";
import type { EmailProvider } from "@ai-comms-agent/shared";
import { publishEmailSync } from "../queues/email-sync-rabbitmq";
import { indexEmailKnowledge } from "../knowledge/email-knowledge-indexer";
import type { EmailSyncPayload } from "../queues/email-sync-message";

type Candidate = {
  id: string;
  organization_id: string;
  email_address: string;
  provider: "gmail" | "zoho" | "imap_smtp";
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
       internet_message_id, in_reply_to, references_header, from_email, to_recipients,
       cc_recipients, bcc_recipients, subject, text_body, html_body_sanitized, snippet,
       headers, labels, is_read, is_starred, is_draft, is_sent, importance_score,
       action_required, received_at, sent_at, provider_updated_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,NULL,$15,
       '{}'::jsonb,$16::jsonb,$17,$18,$19,$20,$21,$22,$23,$24,$23,now())
     ON CONFLICT (email_account_id, provider_message_id)
     DO UPDATE SET thread_id=EXCLUDED.thread_id, folder_id=EXCLUDED.folder_id,
       internet_message_id=EXCLUDED.internet_message_id, in_reply_to=EXCLUDED.in_reply_to,
       references_header=EXCLUDED.references_header, from_email=EXCLUDED.from_email,
       to_recipients=EXCLUDED.to_recipients, cc_recipients=EXCLUDED.cc_recipients,
       bcc_recipients=EXCLUDED.bcc_recipients, subject=EXCLUDED.subject,
       text_body=EXCLUDED.text_body, snippet=EXCLUDED.snippet, labels=EXCLUDED.labels,
       is_read=EXCLUDED.is_read, is_starred=EXCLUDED.is_starred, is_draft=EXCLUDED.is_draft,
       is_sent=EXCLUDED.is_sent, importance_score=EXCLUDED.importance_score,
       provider_updated_at=EXCLUDED.provider_updated_at, updated_at=now()`,
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
      JSON.stringify(message.to_addresses ?? []),
      JSON.stringify(message.cc_addresses ?? []),
      JSON.stringify(message.bcc_addresses ?? []),
      message.subject || "",
      message.text_body || "",
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

  await indexEmailKnowledge({
    organizationId: account.organization_id,
    accountId: account.id,
    provider: account.provider,
    message,
  });
}

async function processAccount(candidate: Candidate): Promise<boolean> {
  const claimed = await query<{
    cursor: string | null;
    history_id: string | null;
    last_success_at: string | null;
  }>(
    `INSERT INTO email_sync_states
      (email_account_id, organization_id, status, last_attempt_at, updated_at)
     VALUES ($1,$2,'running',now(),now())
     ON CONFLICT (email_account_id) DO UPDATE
       SET status='running', last_attempt_at=now(), updated_at=now()
       WHERE email_sync_states.status <> 'running'
          OR email_sync_states.last_attempt_at < now()-interval '10 minutes'
     RETURNING cursor, history_id, last_success_at`,
    [candidate.id, candidate.organization_id],
  );
  if (!claimed.rows[0]) return false;

  const accounts = new PostgresEmailAccountRepository();
  const adapter: EmailProvider & { getCredentialSnapshot?: () => EmailCredentials; listDraftIdsByMessage?: () => Promise<Map<string, string>> } = candidate.provider === "gmail" ? new GmailAdapter() : candidate.provider === "zoho" ? new ZohoAdapter() : new ImapSmtpAdapter();

  try {
    const masterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
    if (!masterKey) throw new Error("CREDENTIALS_MASTER_KEY is required for mailbox synchronization.");
    const stored = await accounts.loadCredentials(candidate.id, parseCredentialsMasterKey(masterKey));
    if (!stored) throw new Error("Encrypted mailbox credentials are missing. Reconnect this mailbox.");

    const credentials: EmailCredentials = {
      ...(stored as unknown as EmailCredentials),
      credential_type: candidate.provider === "imap_smtp" ? ((stored as unknown as EmailCredentials).credential_type ?? "app_password") : "oauth_token",
    };
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

    const state: SyncState = {
      cursor: claimed.rows[0].cursor ?? undefined,
      history_token: claimed.rows[0].history_id ?? undefined,
      last_sync_at: claimed.rows[0].last_success_at ?? new Date(0).toISOString(),
      sync_mode: claimed.rows[0].cursor || !claimed.rows[0].history_id ? "initial" : "incremental",
    };
    const result = await adapter.sync(state);
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
    const messageIds = new Set([
      ...result.added.map((item) => item.provider_message_id),
      ...result.updated.map((item) => item.provider_message_id),
    ]);
    const ids = [...messageIds];
    const fetchedMessages: EmailMessage[] = [];
    for (let offset = 0; offset < ids.length; offset += 8) {
      const page = await Promise.all(ids.slice(offset, offset + 8).map((id) => adapter.getMessage(id)));
      for (const message of page) if (message) fetchedMessages.push(message);
    }
    const draftIdsByMessage = fetchedMessages.some((message) => message.is_draft) && adapter.listDraftIdsByMessage
      ? await adapter.listDraftIdsByMessage()
      : new Map<string, string>();
    let saved = 0;
    for (const message of fetchedMessages) {
      const providerDraftId = message.is_draft
        ? draftIdsByMessage.get(message.provider_message_id || message.id) ?? (candidate.provider === "zoho" ? (message.provider_message_id || message.id) : null)
        : null;
      await persistMessage(candidate, message, providerDraftId);
      saved += 1;
    }

    await query(
      `UPDATE email_sync_states SET cursor=$1, history_id=$2, status='idle',
         last_success_at=now(), last_attempt_at=now(), next_attempt_at=NULL,
         error_count=0, last_error=NULL, updated_at=now()
       WHERE email_account_id=$3`,
      [result.new_state.cursor ?? null, result.new_state.history_token ?? null, candidate.id],
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
      sync_mode: result.new_state.sync_mode,
      initial_import_remaining: result.new_state.sync_mode === "initial",
    }));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Gmail synchronization failed.";
    const revoked = /invalid_grant|no refresh token is available|refresh token.*revoked/i.test(message);
    await query(
      `UPDATE email_sync_states SET status='error', last_attempt_at=now(),
         next_attempt_at=now()+make_interval(secs => LEAST(3600, 60 * power(2, LEAST(error_count,5))::int)),
         error_count=error_count+1, last_error=$1, updated_at=now()
       WHERE email_account_id=$2`,
      [message, candidate.id],
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
       s.cursor AS sync_cursor, s.history_id, s.last_success_at
     FROM email_accounts a
     LEFT JOIN email_sync_states s ON s.email_account_id=a.id
     WHERE a.id=$1 AND a.deleted_at IS NULL
       AND a.provider IN ('gmail','zoho','imap_smtp')
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
  const state = await query<{ status: string; last_attempt_at: string | null }>(
    "SELECT status, last_attempt_at FROM email_sync_states WHERE email_account_id=$1",
    [candidate.id],
  );
  const current = state.rows[0];
  const activeClaim = current?.status === "running"
    && current.last_attempt_at !== null
    && Date.now() - new Date(current.last_attempt_at).getTime() < 10 * 60_000;
  if (activeClaim) return;
  throw new Error("Mailbox sync did not complete; retry delivery is required.");
}

async function enqueueDueMailboxSyncs(limit = BATCH_SIZE): Promise<number> {
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY || !process.env.RABBITMQ_URL) return 0;
  const result = await query<Candidate>(
    `SELECT a.id, a.organization_id, a.email_address, a.provider,
       s.cursor AS sync_cursor, s.history_id, s.last_success_at
     FROM email_accounts a
     LEFT JOIN email_sync_states s ON s.email_account_id=a.id
     WHERE a.provider IN ('gmail','zoho','imap_smtp') AND a.deleted_at IS NULL
       AND a.status IN ('pending','connected','error')
       AND COALESCE(s.status::text,'idle') <> 'paused'
       AND (s.next_attempt_at IS NULL OR s.next_attempt_at <= now())
       AND (s.status IS NULL OR s.status <> 'running'
         OR s.last_attempt_at < now()-interval '10 minutes')
       AND (s.last_attempt_at IS NULL OR s.last_attempt_at < now()-interval '10 seconds')
       AND (s.last_success_at IS NULL
         OR s.last_success_at < now()-interval '15 minutes'
         OR a.status IN ('pending','error'))
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
       VALUES ($1,$2,'idle',now()+interval '15 minutes',now())
       ON CONFLICT (email_account_id) DO UPDATE SET
         next_attempt_at=now()+interval '15 minutes', updated_at=now()
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
         s.cursor AS sync_cursor, s.history_id, s.last_success_at
       FROM email_accounts a
       LEFT JOIN email_sync_states s ON s.email_account_id=a.id
       WHERE a.provider IN ('gmail','zoho','imap_smtp') AND a.deleted_at IS NULL
         AND a.status IN ('pending','connected','error')
         AND COALESCE(s.status::text,'idle') <> 'paused'
         AND (s.next_attempt_at IS NULL OR s.next_attempt_at <= now())
         AND (s.status IS NULL OR s.status <> 'running'
           OR s.last_attempt_at < now()-interval '10 minutes')
         AND (s.last_attempt_at IS NULL OR s.last_attempt_at < now()-interval '10 seconds')
         AND (s.last_success_at IS NULL
           OR s.last_success_at < now()-interval '15 minutes'
           OR a.status IN ('pending','error'))
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
    try {
      if (queueEnabled) await enqueueDueMailboxSyncs();
      else await processMailboxSyncBatch();
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "worker.email-sync",
        message: queueEnabled ? "Mailbox queue producer poll failed" : "Mailbox synchronization poll failed",
        reason: error instanceof Error ? error.message : "Unknown worker error",
      }));
    }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
