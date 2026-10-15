import { NextResponse } from "next/server";
import { query } from "@ai-comms-agent/db";

export const dynamic = "force-dynamic";

/**
 * Gmail Pub/Sub push endpoint.
 *
 * When Gmail detects a mailbox change (new email, label change, etc.),
 * it publishes a message to the Google Cloud Pub/Sub topic. The Pub/Sub
 * subscription is configured to push to this endpoint.
 *
 * The push body is a JSON wrapper:
 * {
 *   "message": {
 *     "data": "<base64-encoded JSON>",
 *     "messageId": "...",
 *     "publishTime": "..."
 *   },
 *   "subscription": "projects/xxx/subscriptions/xxx"
 * }
 *
 * The decoded `data` is a Gmail notification:
 * {
 *   "historyId": "12345",
 *   "emailAddress": "user@gmail.com"
 * }
 *
 * This endpoint:
 * 1. Decodes the base64 data
 * 2. Finds the email account by emailAddress
 * 3. Updates the sync state: history_id = new historyId, next_attempt_at = now()
 * 4. The worker's next poll (within 10 seconds) will pick this up and run
 *    an incremental sync (Gmail History API) to fetch the new messages.
 *
 * For TRUE real-time (sub-second), we could also directly trigger the sync
 * here instead of waiting for the next poll. But that would require
 * publishing to the RabbitMQ queue from within the webhook, which adds
 * complexity. The 10-second poll delay is acceptable for most use cases.
 *
 * Security: Gmail Pub/Sub push requests are NOT authenticated by default.
 * To verify authenticity, you can either:
 * - Configure the Pub/Sub subscription with an authentication token header
 *   (PUBSUB_VERIFICATION_TOKEN env var) and check it here
 * - OR use the Pub/Sub push endpoint verification flow
 * For now, we accept all requests but only update sync state for known
 * email addresses in the DB.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      message?: { data?: string; messageId?: string; publishTime?: string };
      subscription?: string;
    } | null;

    if (!body?.message?.data) {
      // Not a valid Pub/Sub push — return 200 so Pub/Sub doesn't retry
      return NextResponse.json({ ok: true, error: "no_data" });
    }

    // Decode the base64 data payload
    let decoded: { historyId?: string; emailAddress?: string };
    try {
      decoded = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8"));
    } catch {
      return NextResponse.json({ ok: true, error: "invalid_data" });
    }

    const { historyId, emailAddress } = decoded;
    if (!historyId || !emailAddress) {
      return NextResponse.json({ ok: true, error: "missing_fields" });
    }

    // Optional: verify a token header for security
    const verificationToken = process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN;
    if (verificationToken) {
      const tokenHeader = request.headers.get("x-goog-token") ?? "";
      if (tokenHeader !== verificationToken) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }

    // Find the email account by email address
    const accountResult = await query<{ id: string; organization_id: string }>(
      `SELECT id, organization_id FROM email_accounts
       WHERE email_address = $1 AND provider = 'gmail' AND deleted_at IS NULL
       LIMIT 1`,
      [emailAddress.toLowerCase()],
    );

    if (!accountResult.rows[0]) {
      // Unknown email address — might be for an account that was deleted
      // or never connected. Return 200 so Pub/Sub doesn't retry.
      return NextResponse.json({ ok: true, error: "unknown_account" });
    }

    const accountId = accountResult.rows[0].id;

    // Update the sync state with the new historyId and trigger an immediate
    // sync by setting next_attempt_at = now(). The worker's poller runs
    // every 10 seconds and will pick this up.
    await query(
      `UPDATE email_sync_states
       SET history_id = $1,
           next_attempt_at = now(),
           status = CASE WHEN status = 'running' THEN status ELSE 'idle' END,
           updated_at = now()
       WHERE email_account_id = $2`,
      [historyId, accountId],
    );

    // Log the push notification receipt
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "gmail.push",
      message: "Pub/Sub push notification received",
      email_address: emailAddress,
      history_id: historyId,
      account_id: accountId,
    }));

    return NextResponse.json({ ok: true, historyId, emailAddress });
  } catch (error) {
    // Return 200 even on error — Pub/Sub retries on non-200 responses,
    // and we don't want infinite retries for a transient DB error.
    console.error("[gmail/push]", error);
    return NextResponse.json({ ok: true, error: "internal" });
  }
}
