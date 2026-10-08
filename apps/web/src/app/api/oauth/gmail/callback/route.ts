import { createHmac } from "node:crypto";
import { loadGmailOAuthConfiguration } from "@/lib/oauth/gmail-config";
import { NextResponse } from "next/server";
import { PostgresEmailAccountRepository, parseCredentialsMasterKey, recordAuditEvent } from "@ai-comms-agent/db";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { authorize } from "@/lib/identity/authorization";

export const dynamic = "force-dynamic";

function verify(encoded: string, signature: string) {
  const raw = process.env.CREDENTIALS_MASTER_KEY;
  if (!raw) return false;
  const key = parseCredentialsMasterKey(raw);
  const expected = createHmac("sha256", key).update(encoded).digest("base64url");
  return expected === signature;
}

function oauthError(message: string, request: Request, status = 400) {
  const safeMessage = message.slice(0, 240);
  const response = NextResponse.redirect(
    new URL(`/mail/accounts?providerError=${encodeURIComponent(safeMessage)}`, request.url),
    303,
  );
  response.headers.set("x-oauth-error-status", String(status));
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verifier = request.headers.get("cookie")?.match(/(?:^|; )gmail_oauth_verifier=([^;]+)/)?.[1];
  if (!code || !state || !verifier) return oauthError("The Gmail authorization session is incomplete or expired.", request);

  const stateCookie = request.headers.get("cookie")?.match(/(?:^|; )gmail_oauth_state=([^;]+)/)?.[1];
  if (!stateCookie || stateCookie !== state) return oauthError("Invalid or expired Gmail OAuth session.", request);
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature || !verify(encoded, signature)) return oauthError("Invalid Gmail OAuth state.", request);
  let payload: { organizationId: string; userId: string; configId: string; accountId?: string; exp: number };
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return oauthError("Invalid Gmail OAuth state.", request);
  }
  if (!payload.organizationId || !payload.userId || !payload.configId || payload.exp < Date.now()) return oauthError("Gmail OAuth state has expired.", request);

  try {
    await authorize(
      request,
      { organizationId: payload.organizationId as any, role: "admin" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );
  } catch {
    return oauthError("You are not authorized to connect an email account for this organization.", request, 403);
  }

  const oauthConfig = await loadGmailOAuthConfiguration(payload.organizationId, payload.configId).catch(() => null);
  if (!oauthConfig) return oauthError("The selected Gmail OAuth configuration was removed or disabled.", request, 409);
  const { clientId, clientSecret, redirectUri } = oauthConfig;

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
    if (!tokenResponse.ok) return oauthError("Google rejected the authorization code.", request, 502);
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!tokens.access_token) return oauthError("Google did not return an access token.", request, 502);

    const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) return oauthError("Gmail account verification failed.", request, 502);
    const profile = await profileResponse.json() as { emailAddress?: string; historyId?: string };
    if (!profile.emailAddress) return oauthError("Gmail did not return an account address.", request, 502);

    const masterKey = process.env.CREDENTIALS_MASTER_KEY
      ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY)
      : null;
    if (!masterKey) return oauthError("Credential encryption is not configured on the server.", request, 503);

    const repository = new PostgresEmailAccountRepository();
    if (payload.accountId) {
      const target = await repository.getById(payload.accountId);
      if (!target || target.organization_id !== payload.organizationId || target.provider !== "gmail") {
        return oauthError("The Gmail reconnect target is invalid.", request, 409);
      }
    }
    const capabilities = {
      folders: true, labels: true, sync_incremental: true, sync_full: true, sync_webhook: true, sync_idle: false,
      search_server_side: true, search_client_side: true, drafts: true, reply: true, forward: true,
      mark_read: true, archive: true, move: true, threads: true, attachments_download: true,
      attachments_upload: false, send: true,
    };
    const existing = payload.accountId
      ? await repository.getById(payload.accountId)
      : await repository.findByOrganizationProviderAddress(payload.organizationId, "gmail", profile.emailAddress);
    const account = existing
      ? await repository.updateConnection(existing.id, {
          emailAddress: profile.emailAddress,
          displayName: profile.emailAddress,
          connectionConfig: { historyId: profile.historyId ?? null, oauthScope: tokens.scope ?? null, oauthConfigId: oauthConfig.id },
          status: "pending",
          capabilities,
        })
      : await repository.create({
          organizationId: payload.organizationId,
          provider: "gmail",
          emailAddress: profile.emailAddress,
          displayName: profile.emailAddress,
          connectionConfig: { historyId: profile.historyId ?? null, oauthScope: tokens.scope ?? null, oauthConfigId: oauthConfig.id },
          status: "pending",
          capabilities,
        });
    if (!account) return oauthError("Gmail account could not be persisted.", request, 500);

    await repository.saveCredentials(account.id, "oauth_token", {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined,
      scope: tokens.scope,
      oauth_client_id: clientId,
      oauth_client_secret: clientSecret,
      oauth_config_id: oauthConfig.id,
    }, masterKey);
    await repository.updateStatus(account.id, "pending");

    await recordAuditEvent({
      organizationId: payload.organizationId,
      actorUserId: payload.userId,
      eventType: "email.account.pending_verification",
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
    return oauthError("Gmail connection could not be completed.", request, 500);
  }
}
