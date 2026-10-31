import { NextResponse } from "next/server";
import {
  PostgresEmailAccountRepository, parseCredentialsMasterKey, query,
} from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";

const safe = (message: string, status: number, error = "not_configured") =>
  NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } });

/** Manual Gmail watch registration uses the same authenticated OIDC receiver,
 * watch metadata, and renewal policy as the worker. Never advance the durable
 * Gmail history cursor here: the sync worker must first reconcile the gap. */
export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch { return safe("Invalid request origin.", 403, "invalid_origin"); }

  try {
    const body: unknown = await request.json().catch(() => null);
    const input = body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown> : {};
    const organizationId = typeof input.organizationId === "string" ? input.organizationId.trim() : "";
    const accountId = typeof input.accountId === "string" ? input.accountId.trim() : "";
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(organizationId) || !uuid.test(accountId)) {
      return safe("Select a valid organization and Gmail account.", 422, "validation_error");
    }
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" },
      getIdentityAdapter(), getIdentityRepository());

    if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) {
      return safe("Database and encrypted credentials must be configured.", 503);
    }
    const topic = process.env.GMAIL_PUBSUB_TOPIC?.trim() ?? "";
    const audience = process.env.GMAIL_PUBSUB_PUSH_AUDIENCE?.trim() ?? "";
    const serviceAccount = process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT?.trim() ?? "";
    if (!/^projects\/[^/]+\/topics\/[^/]+$/.test(topic)
      || !audience || !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(serviceAccount)) {
      return safe("Configure the Google Pub/Sub topic, authenticated push audience and service account before registering Gmail watches.", 503);
    }

    const matches = await query<{ id: string; email_address: string }>(
      "SELECT id,email_address FROM email_accounts WHERE id=$1 AND organization_id=$2 AND provider='gmail' AND status IN ('connected','pending') AND deleted_at IS NULL",
      [accountId, organizationId]);
    const account = matches.rows[0];
    if (!account) return safe("Gmail account is not connected to this organization.", 404, "not_found");

    const key = parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY);
    const repo = new PostgresEmailAccountRepository();
    const credentials = await repo.loadCredentials(accountId, key);
    if (!credentials || credentials.credential_type !== "oauth_token") {
      return safe("Gmail OAuth credentials are unavailable. Reconnect this mailbox.", 503);
    }
    let accessToken = typeof credentials.access_token === "string" ? credentials.access_token : "";
    const expiry = typeof credentials.expires_at === "string" ? Date.parse(credentials.expires_at) : NaN;
    if (!accessToken || !Number.isFinite(expiry) || expiry <= Date.now() + 30_000) {
      const { oauth_client_id: clientId, oauth_client_secret: clientSecret, refresh_token: refreshToken } = credentials;
      if (typeof clientId !== "string" || typeof clientSecret !== "string" || typeof refreshToken !== "string") {
        return safe("Gmail access needs a new OAuth authorization.", 503, "oauth_reconnect_required");
      }
      const refreshed = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          refresh_token: refreshToken, grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!refreshed.ok) return safe("Google rejected the Gmail refresh token. Reconnect the mailbox.", 502, "token_refresh_failed");
      const next = await refreshed.json() as { access_token?: string; expires_in?: number };
      if (!next.access_token || !Number.isFinite(next.expires_in) || (next.expires_in ?? 0) <= 0) {
        return safe("Google did not return usable Gmail credentials.", 502, "token_refresh_failed");
      }
      accessToken = next.access_token;
      await repo.saveCredentials(accountId, "oauth_token", {
        ...credentials, access_token: accessToken,
        expires_at: new Date(Date.now() + next.expires_in! * 1000).toISOString(),
      }, key);
    }

    const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(12_000),
    });
    if (!profileResponse.ok) return safe("Google could not validate this mailbox.", 502, "profile_failed");
    const profile = await profileResponse.json() as { emailAddress?: string };
    if (profile.emailAddress?.trim().toLowerCase() !== account.email_address.trim().toLowerCase()) {
      return safe("Authenticated Google account does not match the selected mailbox.", 409, "mailbox_mismatch");
    }

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ topicName: topic, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      // Do not return untrusted Google response bodies: they can disclose
      // infrastructure details. Gmail sync continues through polling.
      return safe("Google could not register the mailbox watch. Verify the Pub/Sub topic and Gmail publisher IAM grant.", 502, "watch_failed");
    }
    const watch = await response.json() as { historyId?: string; expiration?: string };
    if (typeof watch.historyId !== "string" || !/^\d+$/.test(watch.historyId)
      || typeof watch.expiration !== "string" || !/^\d+$/.test(watch.expiration)
      || Number(watch.expiration) <= Date.now()) {
      return safe("Google returned an invalid mailbox watch response.", 502, "invalid_watch_response");
    }
    const expiresAt = new Date(Number(watch.expiration)).toISOString();
    const metadata = JSON.stringify({
      gmailWatchHistoryId: watch.historyId, gmailWatchExpiresAt: expiresAt,
      gmailWatchRenewedAt: new Date().toISOString(),
    });
    await query(
      `UPDATE email_accounts
       SET connection_config=(COALESCE(connection_config,'{}'::jsonb) || $1::jsonb)
         - ARRAY['gmailWatchRetryAt','gmailWatchErrorCount','gmailWatchLastError'],
           updated_at=now()
       WHERE id=$2 AND organization_id=$3 AND provider='gmail' AND deleted_at IS NULL`,
      [metadata, accountId, organizationId],
    );
    // Only the sync worker commits email_sync_states.history_id after it has
    // fetched and persisted every change. Registration is not reconciliation.
    return NextResponse.json({
      ok: true, expiresAt, pushEndpoint: `${process.env.APP_ORIGIN ?? new URL(request.url).origin}/api/webhooks/gmail`,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[gmail/watch] Failed to register authenticated watch", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return authorizationErrorToResponse(error);
  }
}
