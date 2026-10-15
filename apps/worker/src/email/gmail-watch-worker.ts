import {
  parseCredentialsMasterKey,
  PostgresEmailAccountRepository,
  query,
} from "@ai-comms-agent/db";
import type { EmailCredentials } from "@ai-comms-agent/shared";
import { GmailAdapter } from "./gmail-adapter";

type WatchCandidate = {
  id: string;
  organization_id: string;
  email_address: string;
  connection_config: Record<string, unknown> | null;
};

const WATCH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
let running = false;

async function renewDueWatches(): Promise<{ checked: number; renewed: number }> {
  const topicName = process.env.GMAIL_PUBSUB_TOPIC?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const masterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
  const pushAudience = process.env.GMAIL_PUBSUB_PUSH_AUDIENCE?.trim();
  const pushServiceAccount = process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT?.trim();
  if (!topicName || !databaseUrl || !masterKey || !pushAudience || !pushServiceAccount) {
    return { checked: 0, renewed: 0 };
  }

  const due = await query<WatchCandidate>(
    `SELECT a.id, a.organization_id, a.email_address, a.connection_config
       FROM email_accounts a
       WHERE a.provider='gmail' AND a.deleted_at IS NULL
         AND a.status IN ('pending','connected','error')
         AND (
           a.connection_config->>'gmailWatchRetryAt' IS NULL
           OR (a.connection_config->>'gmailWatchRetryAt')::timestamptz <= now()
         )
         AND (
           a.connection_config->>'gmailWatchExpiresAt' IS NULL
           OR (a.connection_config->>'gmailWatchExpiresAt')::timestamptz
                <= now() + interval '24 hours'
         )
       ORDER BY a.created_at ASC
       LIMIT 50`,
  );
  const accounts = new PostgresEmailAccountRepository();
  const key = parseCredentialsMasterKey(masterKey);
  let renewed = 0;

  for (const candidate of due.rows) {
    const adapter = new GmailAdapter();
    try {
      const stored = await accounts.loadCredentials(candidate.id, key);
      if (!stored) throw new Error("Encrypted Gmail credentials are missing.");
      await adapter.connect(stored as EmailCredentials);
      const profile = await adapter.getMailboxProfile();
      if (profile.emailAddress.trim().toLowerCase() !== candidate.email_address.trim().toLowerCase()) {
        throw new Error("Authenticated Gmail mailbox does not match the connected account address.");
      }
      const watch = await adapter.registerMailboxWatch(topicName);
      await accounts.saveCredentials(candidate.id, "oauth_token", adapter.getCredentialSnapshot(), key);
      const config = { ...(candidate.connection_config ?? {}) };
      config.gmailWatchExpiresAt = watch.expiration;
      config.gmailWatchHistoryId = watch.historyId;
      config.gmailWatchRenewedAt = new Date().toISOString();
      delete config.gmailWatchRetryAt;
      delete config.gmailWatchErrorCount;
      delete config.gmailWatchLastError;
      await query(
        `UPDATE email_accounts
           SET connection_config=$1::jsonb, updated_at=now()
           WHERE id=$2 AND provider='gmail' AND deleted_at IS NULL`,
        [JSON.stringify(config), candidate.id],
      );
      renewed += 1;
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        service: "worker.email-gmail-watch",
        message: "Gmail mailbox watch registered or renewed",
        organization_id: candidate.organization_id,
        account_id: candidate.id,
        expires_at: watch.expiration,
      }));
    } catch (error) {
      const config = { ...(candidate.connection_config ?? {}) };
      const previousCount = Number(config.gmailWatchErrorCount ?? 0);
      const errorCount = Number.isFinite(previousCount) ? Math.max(0, Math.min(10, Math.floor(previousCount))) : 0;
      const retryDelaySeconds = Math.min(21_600, 300 * 2 ** Math.min(errorCount, 6));
      config.gmailWatchErrorCount = errorCount + 1;
      config.gmailWatchRetryAt = new Date(Date.now() + retryDelaySeconds * 1000).toISOString();
      config.gmailWatchLastError = error instanceof Error ? error.message.slice(0, 200) : "Unknown error";
      await query(
        `UPDATE email_accounts SET connection_config=$1::jsonb, updated_at=now()
           WHERE id=$2 AND provider='gmail' AND deleted_at IS NULL`,
        [JSON.stringify(config), candidate.id],
      ).catch(() => undefined);
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "worker.email-gmail-watch",
        message: "Gmail mailbox watch registration or renewal failed",
        organization_id: candidate.organization_id,
        account_id: candidate.id,
        reason: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
      }));
    } finally {
      await adapter.disconnect().catch(() => undefined);
    }
  }
  return { checked: due.rows.length, renewed };
}

export function startGmailWatchRenewalLoop() {
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY
    || !process.env.GMAIL_PUBSUB_TOPIC?.trim()
    || !process.env.GMAIL_PUBSUB_PUSH_AUDIENCE?.trim()
    || !process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT?.trim()) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      service: "worker.email-gmail-watch",
      message: "Gmail watch renewal disabled: database, credential encryption, Pub/Sub topic, push audience, and push service account are required",
    }));
    return () => undefined;
  }

  let stopped = false;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const result = await renewDueWatches();
      if (result.checked > 0) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          service: "worker.email-gmail-watch",
          message: "Gmail watch renewal pass completed",
          ...result,
        }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "worker.email-gmail-watch",
        message: "Gmail watch renewal pass failed",
        reason: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
      }));
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, WATCH_CHECK_INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
