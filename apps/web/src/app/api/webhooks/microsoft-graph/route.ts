import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  parseCredentialsMasterKey,
  PostgresEmailAccountRepository,
  query,
} from "@ai-comms-agent/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GraphNotification = {
  subscriptionId?: string;
  clientState?: string;
  changeType?: string;
  resource?: string;
};
type GraphNotificationAccount = {
  id: string;
  organization_id: string;
  sync_status: string | null;
};

function constantTimeEqual(expected: string, supplied: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function validationResponse(token: string): Response {
  return new Response(token, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("validationToken");
  if (token !== null) return validationResponse(token);
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken !== null) return validationResponse(validationToken);
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let rawBody: string;
  try { rawBody = await request.text(); }
  catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }
  if (Buffer.byteLength(rawBody, "utf8") > 1_000_000) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let notifications: GraphNotification[];
  try {
    const payload = JSON.parse(rawBody) as { value?: unknown };
    if (!Array.isArray(payload.value)) return NextResponse.json({ error: "invalid_notification_envelope" }, { status: 400 });
    notifications = payload.value.filter((item): item is GraphNotification => !!item && typeof item === "object" && !Array.isArray(item));
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    const masterKey = parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY);
    const repository = new PostgresEmailAccountRepository();
    let accepted = 0;
    let rejected = 0;
    for (const notification of notifications) {
      if (typeof notification.subscriptionId !== "string" || !notification.subscriptionId
        || typeof notification.clientState !== "string" || !notification.clientState) {
        rejected += 1;
        continue;
      }
      const matches = await query<GraphNotificationAccount>(
        `SELECT a.id, a.organization_id, s.status::text AS sync_status
           FROM email_accounts a
           LEFT JOIN email_sync_states s ON s.email_account_id=a.id
          WHERE a.provider='microsoft_graph' AND a.deleted_at IS NULL
            AND a.connection_config->>'microsoftGraphSubscriptionId'=$1
          LIMIT 2`,
        [notification.subscriptionId],
      );
      if (matches.rows.length !== 1) {
        rejected += 1;
        continue;
      }
      const account = matches.rows[0];
      if (!account) {
        rejected += 1;
        continue;
      }
      const credentials = await repository.loadCredentials(account.id, masterKey);
      const expectedState = typeof credentials?.microsoft_graph_client_state === "string"
        ? credentials.microsoft_graph_client_state
        : "";
      if (!expectedState || !constantTimeEqual(expectedState, notification.clientState)) {
        rejected += 1;
        continue;
      }
      if (account.sync_status !== "paused") {
        await query(
          `INSERT INTO email_sync_states
             (email_account_id, organization_id, status, next_attempt_at, pending_push_at, updated_at)
           VALUES ($1,$2,'idle',now(),now(),now())
           ON CONFLICT (email_account_id) DO UPDATE SET
             next_attempt_at=now(), pending_push_at=now(), updated_at=now()
           WHERE email_sync_states.status <> 'paused'`,
          [account.id, account.organization_id],
        );
      }
      accepted += 1;
    }
    if (rejected) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        service: "webhook.microsoft-graph",
        message: "Some Graph notifications were ignored because subscription identity could not be verified",
        accepted_count: accepted,
        rejected_count: rejected,
      }));
    }
    // Acknowledge the batch to avoid Graph retry storms; only valid clientState
    // values can schedule a mailbox reconciliation.
    return NextResponse.json({ received: true, accepted, rejected }, { status: 202 });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "webhook.microsoft-graph",
      message: "Could not persist Microsoft Graph notification",
      reason: error instanceof Error ? error.message.slice(0, 200) : "Notification processing failed",
    }));
    return NextResponse.json({ error: "notification_persistence_failed" }, { status: 503 });
  }
}
