import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { PostgresEmailAccountRepository, parseCredentialsMasterKey, recordAuditEvent } from "@ai-comms-agent/db";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { authorize } from "@/lib/identity/authorization";

export const dynamic = "force-dynamic";

function verify(encoded: string, signature: string) {
  const secret = process.env.SESSION_SIGNING_KEY;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  return expected === signature;
}

function oauthError(message: string, status = 400) {
  return NextResponse.json({ error: "oauth_error", message }, { status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verifier = request.headers.get("cookie")?.match(/(?:^|; )gmail_oauth_verifier=([^;]+)/)?.[1];
  if (!code || !state || !verifier) return oauthError("The Gmail authorization session is incomplete or expired.");

  const stateCookie = request.headers.get("cookie")?.match(/(?:^|; )gmail_oauth_state=([^;]+)/)?.[1];
  if (!stateCookie || stateCookie !== state) return oauthError("Invalid or expired Gmail OAuth session.");
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature || !verify(encoded, signature)) return oauthError("Invalid Gmail OAuth state.");
  let payload: { organizationId: string; userId: string; exp: number };
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return oauthError("Invalid Gmail OAuth state.");
  }
  if (!payload.organizationId || !payload.userId || payload.exp < Date.now()) return oauthError("Gmail OAuth state has expired.");

  try {
    await authorize(
      request,
      { organizationId: payload.organizationId as any, role: "admin" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );
  } catch {
    return oauthError("You are not authorized to connect an email account for this organization.", 403);
  }

  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/oauth/gmail/callback`;
  if (!clientId || !clientSecret) return oauthError("Gmail OAuth is not configured on the server.", 503);

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) return oauthError("Google rejected the authorization code.", 502);
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!tokens.access_token) return oauthError("Google did not return an access token.", 502);

    const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) return oauthError("Gmail account verification failed.", 502);
    const profile = await profileResponse.json() as { emailAddress?: string; historyId?: string };
    if (!profile.emailAddress) return oauthError("Gmail did not return an account address.", 502);

    const masterKey = process.env.CREDENTIALS_MASTER_KEY
      ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY)
      : null;
    if (!masterKey) return oauthError("Credential encryption is not configured on the server.", 503);

    const repository = new PostgresEmailAccountRepository();
    const account = await repository.create({
      organizationId: payload.organizationId,
      provider: "gmail",
      emailAddress: profile.emailAddress,
      displayName: profile.emailAddress,
      connectionConfig: { historyId: profile.historyId ?? null, oauthScope: tokens.scope ?? null },
      status: "pending",
      capabilities: {
        folders: true, labels: true, sync_incremental: true, sync_full: true, sync_webhook: true, sync_idle: false,
        search_server_side: true, search_client_side: true, drafts: true, reply: true, forward: true,
        mark_read: true, archive: true, move: true, threads: true, attachments_download: true,
        attachments_upload: false, send: true,
      },
    });

    await repository.saveCredentials(account.id, "oauth_token", {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined,
      scope: tokens.scope,
    }, masterKey);
    const connectedAccount = await repository.updateStatus(account.id, "connected");

    await recordAuditEvent({
      organizationId: payload.organizationId,
      actorUserId: payload.userId,
      eventType: "email.account.connected",
      targetType: "email_account",
      targetId: account.id,
      action: "connect",
      decision: "allowed",
    });

    const response = NextResponse.redirect(new URL("/mail/accounts?connected=gmail", request.url));
    response.cookies.delete("gmail_oauth_verifier");
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (error) {
    console.error("[gmail-oauth] callback failed", error);
    return oauthError("Gmail connection could not be completed.", 500);
  }
}
