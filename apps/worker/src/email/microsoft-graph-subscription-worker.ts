import { randomBytes } from "node:crypto";
import {
  parseCredentialsMasterKey,
  decryptCredential,
  PostgresEmailAccountRepository,
  query,
} from "@ai-comms-agent/db";
import type { EmailCredentials } from "@ai-comms-agent/shared";
import { MicrosoftGraphAdapter } from "./microsoft-graph-adapter";

type Candidate = {
  id: string;
  organization_id: string;
  connection_config: Record<string, unknown> | null;
  notification_url: string | null;
  client_id: string;
  tenant_id: string;
  client_secret_ciphertext: Buffer;
};

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;
const SUBSCRIPTION_LIFETIME_MS = 48 * 60 * 60 * 1000;
let running = false;

function notificationUrl(configured: string): string | null {
  try {
    if (!configured) return null;
    const url = new URL(configured);
    return url.protocol === "https:" && url.pathname === "/api/webhooks/microsoft-graph"
      && !url.username && !url.password && !url.search && !url.hash ? url.toString() : null;
  } catch { return null; }
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
  // `loadCredentials` returns `Record<string, unknown>` (decrypted JSON), which
  // does not structurally overlap with `EmailCredentials` (which requires the
  // discriminated `credential_type` field). Bridge through `unknown` to assert
  // that the decrypted payload is in fact a complete EmailCredentials object.
  // The Microsoft Graph adapter only invokes connect() with the OAuth fields
  // (access_token, refresh_token, expires_at, microsoft_*) so a missing
  // credential_type would not affect runtime behavior — but the cast still
  // needs to be type-safe against the discriminated union.
  const credentials = {
    ...stored,
    credential_type: "oauth_token",
    microsoft_client_id: candidate.client_id,
    microsoft_tenant_id: candidate.tenant_id,
    microsoft_client_secret: decryptCredential(candidate.client_secret_ciphertext, masterKey).toString("utf8"),
  } as unknown as EmailCredentials;
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

async function tick(stopped: () => boolean) {
  if (running || stopped() || !process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) return;
  running = true;
  try {
    const due = await query<Candidate>(
      `SELECT a.id, a.organization_id, a.connection_config,
              c.notification_url, c.client_id, c.tenant_id, c.client_secret_ciphertext
         FROM email_accounts a
         JOIN microsoft_oauth_configs c
           ON c.id::text = a.connection_config->>'oauthConfigId'
          AND c.organization_id=a.organization_id AND c.enabled=true
        WHERE a.provider='microsoft_graph' AND a.status='connected' AND a.deleted_at IS NULL
          AND c.notification_url IS NOT NULL
          AND (
            a.connection_config->>'microsoftGraphSubscriptionRetryAt' IS NULL
            OR (a.connection_config->>'microsoftGraphSubscriptionRetryAt')::timestamptz <= now()
          )
          AND (
            a.connection_config->>'microsoftGraphSubscriptionExpiresAt' IS NULL
            OR (a.connection_config->>'microsoftGraphSubscriptionExpiresAt')::timestamptz <= now() + interval '24 hours'
          )
        ORDER BY a.created_at ASC
        LIMIT 50`,
    );
    const masterKey = parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY);
    for (const candidate of due.rows) {
      if (stopped()) break;
      try {
        const endpoint = notificationUrl(candidate.notification_url ?? "");
        if (!endpoint) continue;
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
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      service: "worker.email-microsoft-subscription",
      message: "Graph subscription worker requires database and platform encryption service",
    }));
    return () => undefined;
  }
  // Each organization's subscription callback URL is read from its encrypted
  // Platform Settings client. No MICROSOFT_GRAPH_* or APP_ORIGIN runtime
  // environment value is read; no configured URL means safe polling only.
  let stopped = false;
  void tick(() => stopped);
  const timer = setInterval(() => { void tick(() => stopped); }, CHECK_INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
