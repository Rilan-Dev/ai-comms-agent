import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  parseCredentialsMasterKey,
  PostgresEmailAccountRepository,
  query,
} from "@ai-comms-agent/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ZohoWebhookAccount = {
  id: string;
  organization_id: string;
  email_address: string;
  sync_status: string | null;
};

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function validSignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(signature.trim(), "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
  }

  const { token } = await context.params;
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return unauthorized();

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (Buffer.byteLength(rawBody, "utf8") > 1_000_000) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const matches = await query<ZohoWebhookAccount>(
      `SELECT a.id, a.organization_id, a.email_address, s.status::text AS sync_status
         FROM email_accounts a
         LEFT JOIN email_sync_states s ON s.email_account_id=a.id
        WHERE a.provider='zoho' AND a.deleted_at IS NULL
          AND a.connection_config->>'zohoWebhookTokenHash'=$1
        LIMIT 2`,
      [tokenHash],
    );
    if (matches.rows.length !== 1) return unauthorized();
    const account = matches.rows[0];
    if (!account) return unauthorized();

    const signature = request.headers.get("x-hook-signature") ?? "";
    const incomingSecret = request.headers.get("x-hook-secret") ?? "";
    if (!signature) return unauthorized();

    const masterKey = parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY);
    const repository = new PostgresEmailAccountRepository();
    const credentials = await repository.loadCredentials(account.id, masterKey);
    if (!credentials) return NextResponse.json({ error: "credentials_missing" }, { status: 503 });

    const storedSecret = typeof credentials.zoho_webhook_secret === "string"
      ? credentials.zoho_webhook_secret
      : "";
    const signingSecret = storedSecret || incomingSecret;
    if (!signingSecret || (storedSecret && incomingSecret && incomingSecret !== storedSecret)
      || !validSignature(signingSecret, rawBody, signature)) {
      return unauthorized();
    }

    let payload: unknown;
    try { payload = JSON.parse(rawBody); }
    catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    // Zoho exposes its HMAC secret only on the first request. The unguessable
    // account-scoped URL authenticates this bootstrap; subsequent requests use
    // the encrypted stored secret and X-Hook-Signature verification.
    if (!storedSecret) {
      await repository.saveCredentials(account.id, "oauth_token", {
        ...credentials,
        zoho_webhook_secret: signingSecret,
      }, masterKey);
    }

    if (account.sync_status === "paused") {
      return NextResponse.json({ received: true, skipped: "sync_paused" }, { status: 200 });
    }

    // Treat webhook content only as a change signal. The provider adapter
    // remains authoritative for fetching, tenant scoping, and persistence.
    await query(
      `INSERT INTO email_sync_states
         (email_account_id, organization_id, status, next_attempt_at, pending_push_at, updated_at)
       VALUES ($1,$2,'idle',now(),now(),now())
       ON CONFLICT (email_account_id) DO UPDATE SET
         next_attempt_at=now(), pending_push_at=now(), updated_at=now()
       WHERE email_sync_states.status <> 'paused'`,
      [account.id, account.organization_id],
    );
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "webhook.zoho",
      message: "Could not authenticate or queue Zoho mailbox notification",
      reason: error instanceof Error ? error.message.slice(0, 200) : "Webhook processing failed",
    }));
    return NextResponse.json({ error: "notification_persistence_failed" }, { status: 503 });
  }
}
