import { X509Certificate, verify as verifySignature } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@ai-comms-agent/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GooglePushClaims = {
  iss?: string;
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iat?: number;
};

type PubSubEnvelope = {
  message?: { data?: string; messageId?: string; publishTime?: string };
  subscription?: string;
};

type GmailPushPayload = { emailAddress?: string; historyId?: string };

let certsCache: { keys: Record<string, string>; expiresAt: number } | undefined;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function decodeSegment(segment: string): Record<string, unknown> {
  const decoded: unknown = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("Invalid JWT segment");
  return decoded as Record<string, unknown>;
}

async function googleSigningCertificates(): Promise<Record<string, string>> {
  if (certsCache && certsCache.expiresAt > Date.now()) return certsCache.keys;
  const response = await fetch("https://www.googleapis.com/oauth2/v1/certs", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google signing certificate request failed");
  const keys = await response.json() as Record<string, string>;
  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] ?? 300);
  certsCache = { keys, expiresAt: Date.now() + Math.max(60, Math.min(maxAge, 21_600)) * 1000 };
  return keys;
}

async function verifyGooglePushJwt(token: string): Promise<GooglePushClaims> {
  const expectedAudience = process.env.GMAIL_PUBSUB_PUSH_AUDIENCE?.trim();
  const expectedServiceAccount = process.env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT?.trim().toLowerCase();
  if (!expectedAudience || !expectedServiceAccount) throw new Error("Gmail Pub/Sub OIDC verification is not configured");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const header = decodeSegment(parts[0]);
  const claims = decodeSegment(parts[1]) as GooglePushClaims;
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Unsupported JWT signature");
  const keys = await googleSigningCertificates();
  const certificate = keys[header.kid];
  if (!certificate) throw new Error("Unknown Google signing key");
  const publicKey = new X509Certificate(certificate).publicKey;
  const signature = Buffer.from(parts[2], "base64url");
  const validSignature = verifySignature(
    "RSA-SHA256",
    Buffer.from(parts[0] + "." + parts[1]),
    publicKey,
    signature,
  );
  if (!validSignature) throw new Error("Invalid JWT signature");

  const now = Math.floor(Date.now() / 1000);
  const issuerValid = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  if (!issuerValid || claims.aud !== expectedAudience
    || claims.email?.trim().toLowerCase() !== expectedServiceAccount
    || !emailVerified || typeof claims.exp !== "number" || claims.exp <= now
    || typeof claims.iat !== "number" || claims.iat > now + 60) {
    throw new Error("JWT claims failed issuer, audience, identity, or time validation");
  }
  return claims;
}

function decodePubSubData(data: string): GmailPushPayload {
  const parsed: unknown = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid Gmail notification payload");
  const payload = parsed as GmailPushPayload;
  if (typeof payload.emailAddress !== "string" || !payload.emailAddress.includes("@")
    || typeof payload.historyId !== "string" || !/^\d+$/.test(payload.historyId)) {
    throw new Error("Gmail notification payload is missing a valid mailbox or history ID");
  }
  return { emailAddress: payload.emailAddress.trim().toLowerCase(), historyId: payload.historyId };
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return unauthorized();

  let claims: GooglePushClaims;
  try {
    claims = await verifyGooglePushJwt(token);
  } catch (error) {
    // Do not log bearer tokens, JWT claims, or notification data.
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      service: "webhook.gmail",
      message: "Rejected Gmail Pub/Sub push authentication",
      reason: error instanceof Error ? error.message.slice(0, 180) : "JWT verification failed",
    }));
    return unauthorized();
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });

  let payload: GmailPushPayload;
  let pubSubMessageId = "";
  try {
    const envelope = await request.json() as PubSubEnvelope;
    if (!envelope.message?.data || typeof envelope.message.messageId !== "string") {
      return NextResponse.json({ error: "invalid_pubsub_envelope" }, { status: 400 });
    }
    payload = decodePubSubData(envelope.message.data);
    pubSubMessageId = envelope.message.messageId;
  } catch {
    return NextResponse.json({ error: "invalid_notification" }, { status: 400 });
  }

  try {
    const matches = await query<{ id: string; organization_id: string }>(
      `SELECT id, organization_id
         FROM email_accounts
        WHERE provider='gmail' AND deleted_at IS NULL
          AND lower(email_address)=lower($1)
        ORDER BY created_at ASC
        LIMIT 2`,
      [payload.emailAddress],
    );
    if (matches.rows.length !== 1) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        service: "webhook.gmail",
        message: matches.rows.length ? "Gmail notification mailbox matched multiple accounts" : "Gmail notification mailbox is not connected",
        account_match_count: matches.rows.length,
      }));
      // Unknown or ambiguous mailbox identities should not create account state.
      return NextResponse.json({ error: "mailbox_not_resolved" }, { status: 404 });
    }

    const account = matches.rows[0];
    await query(
      `INSERT INTO email_sync_states
         (email_account_id, organization_id, status, next_attempt_at, updated_at)
       VALUES ($1,$2,'idle',now(),now())
       ON CONFLICT (email_account_id) DO UPDATE SET
         next_attempt_at=now(), updated_at=now()
       WHERE email_sync_states.status <> 'paused'`,
      [account.id, account.organization_id],
    );
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "webhook.gmail",
      message: "Authenticated Gmail change notification queued for reconciliation",
      organization_id: account.organization_id,
      account_id: account.id,
      history_id: payload.historyId,
      pubsub_message_id: pubSubMessageId,
    }));
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "webhook.gmail",
      message: "Could not persist Gmail notification for reconciliation",
      reason: error instanceof Error ? error.message.slice(0, 220) : "Database operation failed",
    }));
    return NextResponse.json({ error: "notification_persistence_failed" }, { status: 503 });
  }
}
