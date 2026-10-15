import {
  parseCredentialsMasterKey,
  PostgresEmailAccountRepository,
  query,
} from "@ai-comms-agent/db";
import { ImapSmtpAdapter } from "./imap-smtp-adapter";

type IdleCandidate = {
  id: string;
  organization_id: string;
  email_address: string;
  connection_config: Record<string, unknown> | null;
};

type WatchHandle = {
  adapter: ImapSmtpAdapter;
  controller: AbortController;
};

const SCAN_INTERVAL_MS = 30_000;
const MAX_ACTIVE_WATCHES = 20;
const IDLE_REISSUE_MS = 25 * 60 * 1000;
const watches = new Map<string, WatchHandle>();
let scanning = false;

async function updateIdleConfig(
  accountId: string,
  patch: Record<string, unknown>,
  removeKeys: string[] = [],
): Promise<void> {
  await query(
    `UPDATE email_accounts
       SET connection_config=(COALESCE(connection_config,'{}'::jsonb) || $1::jsonb) - $2::text[],
           updated_at=now()
       WHERE id=$3 AND provider='imap_smtp' AND deleted_at IS NULL`,
    [JSON.stringify(patch), removeKeys, accountId],
  );
}

async function scheduleReconciliation(candidate: IdleCandidate): Promise<void> {
  await query(
    `INSERT INTO email_sync_states
       (email_account_id, organization_id, status, next_attempt_at, pending_push_at, updated_at)
     VALUES ($1,$2,'idle',now(),now(),now())
     ON CONFLICT (email_account_id) DO UPDATE SET
       next_attempt_at=now(), pending_push_at=now(), updated_at=now()
     WHERE email_sync_states.status <> 'paused'`,
    [candidate.id, candidate.organization_id],
  );
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "worker.email-imap-idle",
    message: "IMAP IDLE detected mailbox change; reconciliation queued",
    organization_id: candidate.organization_id,
    account_id: candidate.id,
  }));
}

async function watchAccount(candidate: IdleCandidate, masterKey: Buffer, stopped: () => boolean): Promise<void> {
  const adapter = new ImapSmtpAdapter();
  const controller = new AbortController();
  watches.set(candidate.id, { adapter, controller });
  try {
    const accounts = new PostgresEmailAccountRepository();
    const credentials = await accounts.loadCredentials(candidate.id, masterKey);
    if (!credentials) throw new Error("Encrypted IMAP credentials are missing.");
    if (credentials.credential_type !== "oauth_token" && credentials.credential_type !== "password" && credentials.credential_type !== "app_password") {
      throw new Error("Encrypted IMAP credentials have an invalid credential type.");
    }
    await adapter.connect({ ...credentials, credential_type: credentials.credential_type });

    if (!(await adapter.supportsIdle())) {
      await updateIdleConfig(candidate.id, {
        imapIdleSupported: false,
        imapIdleDisabledUntil: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      }, ["imapIdleRetryAt", "imapIdleErrorCount", "imapIdleLastError"]);
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        service: "worker.email-imap-idle",
        message: "IMAP server does not advertise IDLE; periodic synchronization remains active",
        organization_id: candidate.organization_id,
        account_id: candidate.id,
      }));
      return;
    }

    await updateIdleConfig(candidate.id, {
      imapIdleSupported: true,
      imapIdleConnectedAt: new Date().toISOString(),
    }, ["imapIdleRetryAt", "imapIdleErrorCount", "imapIdleLastError", "imapIdleDisabledUntil"]);

    while (!stopped() && !controller.signal.aborted) {
      const result = await adapter.waitForMailboxChange(IDLE_REISSUE_MS, controller.signal);
      if (result === "unsupported") {
        await updateIdleConfig(candidate.id, {
          imapIdleSupported: false,
          imapIdleDisabledUntil: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        });
        return;
      }
      if (result === "changed") await scheduleReconciliation(candidate);
      // Timeout means IDLE was cleanly terminated and should be reissued.
    }
  } catch (error) {
    if (!stopped() && !controller.signal.aborted) {
      const current = candidate.connection_config ?? {};
      const previousCount = Number(current.imapIdleErrorCount ?? 0);
      const errorCount = Number.isFinite(previousCount) ? Math.max(0, Math.min(10, Math.floor(previousCount))) : 0;
      const retryDelaySeconds = Math.min(21_600, 300 * 2 ** Math.min(errorCount, 7));
      await updateIdleConfig(candidate.id, {
        imapIdleSupported: false,
        imapIdleErrorCount: errorCount + 1,
        imapIdleRetryAt: new Date(Date.now() + retryDelaySeconds * 1000).toISOString(),
        imapIdleLastError: error instanceof Error ? error.message.slice(0, 200) : "Unknown error",
      }).catch(() => undefined);
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "worker.email-imap-idle",
        message: "IMAP IDLE watcher failed; periodic synchronization remains active",
        organization_id: candidate.organization_id,
        account_id: candidate.id,
        reason: error instanceof Error ? error.message.slice(0, 240) : "IMAP IDLE watcher failed",
      }));
    }
  } finally {
    await adapter.disconnect().catch(() => undefined);
    const current = watches.get(candidate.id);
    if (current?.adapter === adapter) watches.delete(candidate.id);
  }
}

async function scanAndStart(stopped: () => boolean): Promise<void> {
  if (scanning || stopped() || !process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) return;
  scanning = true;
  try {
    const due = await query<IdleCandidate>(
      `SELECT a.id, a.organization_id, a.email_address, a.connection_config
         FROM email_accounts a
        WHERE a.provider='imap_smtp' AND a.deleted_at IS NULL AND a.status='connected'
          AND (
            a.connection_config->>'imapIdleRetryAt' IS NULL
            OR (a.connection_config->>'imapIdleRetryAt')::timestamptz <= now()
          )
          AND (
            a.connection_config->>'imapIdleDisabledUntil' IS NULL
            OR (a.connection_config->>'imapIdleDisabledUntil')::timestamptz <= now()
          )
        ORDER BY a.created_at ASC
        LIMIT 50`,
    );
    const masterKey = parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY);
    for (const candidate of due.rows) {
      if (stopped() || watches.size >= MAX_ACTIVE_WATCHES) break;
      if (watches.has(candidate.id)) continue;
      void watchAccount(candidate, masterKey, stopped);
    }
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "worker.email-imap-idle",
      message: "IMAP IDLE account scan failed; periodic synchronization remains active",
      reason: error instanceof Error ? error.message.slice(0, 240) : "Account scan failed",
    }));
  } finally {
    scanning = false;
  }
}

export function startImapIdleWorker() {
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      service: "worker.email-imap-idle",
      message: "IMAP IDLE watcher disabled: DATABASE_URL and CREDENTIALS_MASTER_KEY are required",
    }));
    return () => undefined;
  }

  let stopped = false;
  const isStopped = () => stopped;
  void scanAndStart(isStopped);
  const timer = setInterval(() => { void scanAndStart(isStopped); }, SCAN_INTERVAL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
    for (const watch of watches.values()) watch.controller.abort();
  };
}
