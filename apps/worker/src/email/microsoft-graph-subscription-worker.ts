import { randomBytes } from "node:crypto";
import {
  parseCredentialsMasterKey,
  PostgresEmailAccountRepository,
  query,
} from "@ai-comms-agent/db";
import type { EmailCredentials } from "@ai-comms-agent/shared";
import { MicrosoftGraphAdapter } from "./microsoft-graph-adapter";

type Candidate = {
  id: string;
  organization_id: string;
  connection_config: Record<string, unknown> | null;
};

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;
const SUBSCRIPTION_LIFETIME_MS = 48 * 60 * 60 * 1000;
let running = false;

function notificationUrl(): string | null {
  const explicit = process.env.MICROSOFT_GRAPH_NOTIFICATION_URL?.trim();
  const origin = process.env.APP_ORIGIN?.trim();
  const candidate = explicit || (origin ? new URL("/api/webhooks/microsoft-graph", origin).toString() : "");
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && url.pathname === "/api/webhooks/microsoft-graph" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function persistConfig(accountId: string, patch: Record<string, unknown>, remove: string[] = []) {
  await query(
    `UPDATE email_accounts
       SET connection_config=(COALESCE(connection_config,'{}'::jsonb) || $1::jsonb) - $2::text[],
           updated_at=now()
       WHERE id=$3 AND provider='microsoft_graph' AND deleted_at IS NULL`,
    [JSON.stringify(patch), remove, accountId],
  );
}

async function reconcileSubscription(candidate: Candidate, masterKey: Buffer, endpoint: string): Promise<boolean> {
  const repository = new PostgresEmailAccountRepository();
  const stored = await repository.loadCredentials(candidate.id, masterKey);
  if (!stored?.access_token || !stored.refresh_token) throw new Error("Microsoft OAuth credentials or refresh token are missing.");
  const credentials = { ...stored } as EmailCredentials;
  const clientState = credentials.microsoft_graph_client_state || randomBytes(32).toString("base64url");
  const adapter = new MicrosoftGraphAdapter();
  let createdSubscriptionId: string | undefined;
  try {
    await adapter.connect({ ...credentials, microsoft_graph_client_state: clientState });
    const current = candidate.connection_config ?? {};
    const subscriptionId = typeof current.microsoftGraphSubscriptionId === "string" ? current.microsoftGraphSubscriptionId : "";
    const expiresAt = typeof current.microsoftGraphSubscriptionExpiresAt === "string"
      ? Date.parse(current.microsoftGraphSubscriptionExpiresAt)
      : 0;
    const requestedExpiry = new Date(Date.now() + SUBSCRIPTION_LIFETIME_MS).toISOString();
    let subscription: { id: string; expirationDateTime: string } | null = null;

    if (subscriptionId && expiresAt > Date.now() + RENEW_BEFORE_MS) {
      await repository.saveCredentials(candidate.id, "oauth_token", {
        ...adapter.getCredentialSnapshot(),
        microsoft_graph_client_state: clientState,
      }, masterKey);
      return false;
    }

    if (subscriptionId) {
      try {
        subscription = await adapter.renewSubscription(subscriptionId, requestedExpiry);
      } catch (error) {
        if (!(error instanceof Error) || !/HTTP (?:404|410)\b/.test(error.message)) throw error;
      }
    }
    if (!subscription) {
      subscription = await adapter.createInboxSubscription(endpoint, clientState, requestedExpiry);
      createdSubscriptionId = subscription.id;
    }

    await repository.saveCredentials(candidate.id, "oauth_token", {
      ...adapter.getCredentialSnapshot(),
      microsoft_graph_client_state: clientState,
    }, masterKey);
    await persistConfig(candidate.id, {
      microsoftGraphSubscriptionId: subscription.id,
      microsoftGraphSubscriptionExpiresAt: subscription.expirationDateTime,
      microsoftGraphSubscriptionUpdatedAt: new Date().toISOString(),
    }, ["microsoftGraphSubscriptionRetryAt", "microsoftGraphSubscriptionErrorCount", "microsoftGraphSubscriptionLastError"]);
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "worker.email-microsoft-subscription",
      message: "Microsoft Graph message subscription registered or renewed",
      organization_id: candidate.organization_id,
      account_id: candidate.id,
      expires_at: subscription.expirationDateTime,
    }));
    return true;
  } catch (error) {
    if (createdSubscriptionId) await adapter.deleteSubscription(createdSubscriptionId).catch(() => undefined);
    throw error;
  } finally {
    await adapter.disconnect().catch(() => undefined);
  }
}

async function tick(endpoint: string, stopped: () => boolean) {
  if (running || stopped() || !process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) return;
  running = true;
  try {
    const due = await query<Candidate>(
      `SELECT id, organization_id, connection_config
         FROM email_accounts
        WHERE provider='microsoft_graph' AND status='connected' AND deleted_at IS NULL
          AND (
            connection_config->>'microsoftGraphSubscriptionRetryAt' IS NULL
            OR (connection_config->>'microsoftGraphSubscriptionRetryAt')::timestamptz <= now()
          )
          AND (
            connection_config->>'microsoftGraphSubscriptionExpiresAt' IS NULL
            OR (connection_config->>'microsoftGraphSubscriptionExpiresAt')::timestamptz <= now() + interval '24 hours'
          )
        ORDER BY created_at ASC
        LIMIT 50`,
    );
    const masterKey = parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY);
    for (const candidate of due.rows) {
      if (stopped()) break;
      try {
        await reconcileSubscription(candidate, masterKey, endpoint);
      } catch (error) {
        const current = candidate.connection_config ?? {};
        const previous = Number(current.microsoftGraphSubscriptionErrorCount ?? 0);
        const count = Number.isFinite(previous) ? Math.max(0, Math.min(10, Math.floor(previous))) : 0;
        const delaySeconds = Math.min(21_600, 300 * 2 ** Math.min(count, 7));
        await persistConfig(candidate.id, {
          microsoftGraphSubscriptionErrorCount: count + 1,
          microsoftGraphSubscriptionRetryAt: new Date(Date.now() + delaySeconds * 1000).toISOString(),
          microsoftGraphSubscriptionLastError: error instanceof Error ? error.message.slice(0, 200) : "Unknown error",
        }).catch(() => undefined);
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          service: "worker.email-microsoft-subscription",
          message: "Microsoft Graph subscription registration or renewal failed",
          organization_id: candidate.organization_id,
          account_id: candidate.id,
          reason: error instanceof Error ? error.message.slice(0, 240) : "Subscription operation failed",
        }));
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "worker.email-microsoft-subscription",
      message: "Microsoft Graph subscription scan failed",
      reason: error instanceof Error ? error.message.slice(0, 240) : "Subscription scan failed",
    }));
  } finally {
    running = false;
  }
}

export function startMicrosoftGraphSubscriptionWorker() {
  const endpoint = notificationUrl();
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY || !endpoint) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      service: "worker.email-microsoft-subscription",
      message: "Microsoft Graph subscriptions disabled: database, credential encryption, and HTTPS notification URL are required",
    }));
    return () => undefined;
  }
  let stopped = false;
  void tick(endpoint, () => stopped);
  const timer = setInterval(() => { void tick(endpoint, () => stopped); }, CHECK_INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
