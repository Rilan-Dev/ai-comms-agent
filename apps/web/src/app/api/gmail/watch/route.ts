import { NextResponse } from "next/server";
import { query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

/**
 * Register a Gmail Pub/Sub watch for an account.
 *
 * Calls `POST /gmail/v1/users/me/watch` with the configured Pub/Sub topic
 * name. Gmail will then push notifications to the webhook endpoint whenever
 * the mailbox changes (new email, label change, etc.).
 *
 * Gmail watch expires after ~7 days. This endpoint should be called:
 * - After Gmail OAuth connect (auto-registration)
 * - Manually via the UI "Enable real-time sync" button
 * - Periodically (every 5-7 days) to refresh the watch
 *
 * Required env vars:
 * - GMAIL_PUBSUB_TOPIC: The Pub/Sub topic name (e.g., "projects/xxx/topics/gmail-push")
 * - APP_ORIGIN: The app's public URL (for the push endpoint)
 *
 * The push endpoint URL is: {APP_ORIGIN}/api/gmail/push
 */
export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    }

    const body = await request.json().catch(() => null) as { organizationId?: string; accountId?: string } | null;
    const organizationId = body?.organizationId?.trim() ?? new URL(request.url).searchParams.get("organizationId")?.trim() ?? "";
    const accountId = body?.accountId?.trim() ?? new URL(request.url).searchParams.get("accountId")?.trim() ?? "";

    if (!organizationId || !accountId) {
      return NextResponse.json({ error: "validation_error", message: "organizationId and accountId are required." }, { status: 422 });
    }

    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());

    // Check if Pub/Sub topic is configured
    const pubsubTopic = process.env.GMAIL_PUBSUB_TOPIC?.trim();
    if (!pubsubTopic) {
      return NextResponse.json({
        error: "not_configured",
        message: "GMAIL_PUBSUB_TOPIC env var is not set. Create a Google Cloud Pub/Sub topic and set this env var to the topic name (e.g., projects/your-project/topics/gmail-push). Then call this endpoint again.",
      }, { status: 503 });
    }

    // Load the account's encrypted credentials
    const accountResult = await query<{ id: string; email_address: string }>(
      "SELECT id, email_address FROM email_accounts WHERE id = $1 AND organization_id = $2 AND provider = 'gmail' AND deleted_at IS NULL",
      [accountId, organizationId],
    );
    if (!accountResult.rows[0]) {
      return NextResponse.json({ error: "not_found", message: "Gmail account not found." }, { status: 404 });
    }

    // Decrypt credentials
    const credResult = await query<{ ciphertext: Buffer }>(
      "SELECT ciphertext FROM email_account_credentials WHERE email_account_id = $1 LIMIT 1",
      [accountId],
    );
    if (!credResult.rows[0]?.ciphertext) {
      return NextResponse.json({ error: "not_configured", message: "No credentials stored for this account." }, { status: 503 });
    }

    const { decryptCredential, parseCredentialsMasterKey } = await import("@ai-comms-agent/db");
    const masterKey = parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY!);
    const credBuf = Buffer.isBuffer(credResult.rows[0].ciphertext) ? credResult.rows[0].ciphertext : Buffer.from(credResult.rows[0].ciphertext);
    const credentials = JSON.parse(decryptCredential(credBuf, masterKey).toString("utf8"));

    // Refresh the access token if needed
    let accessToken = credentials.access_token;
    const expiresAt = credentials.expires_at ? new Date(credentials.expires_at).getTime() : 0;
    if (expiresAt <= Date.now() + 30000 && credentials.refresh_token) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: credentials.oauth_client_id,
          client_secret: credentials.oauth_client_secret,
          refresh_token: credentials.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      if (!refreshRes.ok) {
        return NextResponse.json({ error: "token_refresh_failed", message: "Could not refresh Gmail OAuth token." }, { status: 502 });
      }
      const refreshData = await refreshRes.json();
      accessToken = refreshData.access_token;
    }

    // Call Gmail watch API
    const watchRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicName: pubsubTopic,
        labelIds: ["INBOX"],
      }),
    });

    if (!watchRes.ok) {
      const errBody = await watchRes.text();
      return NextResponse.json({
        error: "watch_failed",
        message: `Gmail watch API returned ${watchRes.status}: ${errBody.slice(0, 300)}`,
      }, { status: 502 });
    }

    const watchData = await watchRes.json() as {
      historyId?: string;
      expiration?: string;
    };

    // Store the watch info in the connection_config
    const watchExpiration = watchData.expiration ? new Date(Number(watchData.expiration)).toISOString() : null;
    await query(
      `UPDATE email_accounts
       SET connection_config = connection_config || jsonb_build_object(
         'pubsub_watch_history_id', $1::text,
         'pubsub_watch_expiration', $2::text,
         'pubsub_topic', $3::text
       ),
       updated_at = now()
       WHERE id = $4`,
      [watchData.historyId ?? null, watchExpiration, pubsubTopic, accountId],
    );

    // Also update the sync state with the new historyId
    if (watchData.historyId) {
      await query(
        `UPDATE email_sync_states
         SET history_id = $1, next_attempt_at = now(), updated_at = now()
         WHERE email_account_id = $2`,
        [watchData.historyId, accountId],
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Gmail Pub/Sub watch registered successfully. New emails will trigger a push notification to the webhook endpoint within seconds.",
      historyId: watchData.historyId,
      expiration: watchExpiration,
      pushEndpoint: `${process.env.APP_ORIGIN ?? "https://your-app.vercel.app"}/api/gmail/push`,
    });
  } catch (error) {
    console.error("[gmail/watch]", error);
    return authorizationErrorToResponse(error);
  }
}
