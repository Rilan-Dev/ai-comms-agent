import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { PostgresEmailAccountRepository, parseCredentialsMasterKey, recordAuditEvent } from "@ai-comms-agent/db";
import type { CapabilitySet } from "@ai-comms-agent/shared";
import { authorize } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertOAuthRedirectUriSecure, getOAuthPublicOrigin } from "@/lib/oauth/redirect-uri";

export const dynamic = "force-dynamic";

type MicrosoftOAuthState = {
  organizationId: string;
  userId: string;
  tenantId: string;
  clientId: string;
  redirectUri: string;
  accountId?: string;
  exp: number;
};

function signingKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_MASTER_KEY;
  return raw ? parseCredentialsMasterKey(raw) : null;
}

function verify(encoded: string, signature: string): boolean {
  const key = signingKey();
  if (!key) return false;
  const expected = createHmac("sha256", key).update(encoded).digest("base64url");
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(signature);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function safeOrigin(request: Request): string {
  try { return getOAuthPublicOrigin(request); }
  catch { return new URL(request.url).origin; }
}

function oauthError(message: string, request: Request, status = 400) {
  const response = NextResponse.redirect(
    new URL(`/mail/accounts?providerError=${encodeURIComponent(message.slice(0, 220))}`, safeOrigin(request)),
    303,
  );
  response.headers.set("x-oauth-error-status", String(status));
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie") ?? "";
  const verifier = cookie.match(/(?:^|; )microsoft_oauth_verifier=([^;]+)/)?.[1];
  const stateCookie = cookie.match(/(?:^|; )microsoft_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || !verifier || !stateCookie || stateCookie !== state) {
    return oauthError("The Microsoft authorization session is incomplete or invalid.", request);
  }

  const [encoded, signature] = state.split(".");
  if (!encoded || !signature || !verify(encoded, signature)) return oauthError("Invalid Microsoft OAuth state.", request);
  let payload: MicrosoftOAuthState;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
  catch { return oauthError("Invalid Microsoft OAuth state.", request); }

  const configuredClientId = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
  if (!configuredClientId || !clientSecret || payload.clientId !== configuredClientId) {
    return oauthError("Microsoft OAuth configuration changed or is missing.", request, 503);
  }
  if (!payload.organizationId || !payload.userId || !payload.tenantId || !payload.redirectUri
    || typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return oauthError("Microsoft OAuth state has expired.", request);
  }
  try { assertOAuthRedirectUriSecure(payload.redirectUri); }
  catch (error) { return oauthError(error instanceof Error ? error.message : "A valid HTTPS callback is required.", request); }

  try {
    await authorize(request, { organizationId: payload.organizationId as never, role: "admin" }, getIdentityAdapter(), getIdentityRepository());
  } catch {
    return oauthError("You are not authorized to connect an email account for this organization.", request, 403);
  }

  try {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(payload.tenantId)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: configuredClientId,
          client_secret: clientSecret,
          redirect_uri: payload.redirectUri,
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          scope: "openid profile offline_access User.Read Mail.Read",
        }),
      },
    );
    const tokens = await tokenResponse.json().catch(() => ({})) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokens.access_token) {
      return oauthError(tokens.error_description ?? "Microsoft token exchange failed.", request, tokenResponse.status || 502);
    }
    if (!tokens.refresh_token) {
      return oauthError("Microsoft did not issue a refresh token. Ensure offline_access is allowed for the app registration and consent again.", request, 502);
    }

    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", {
      headers: { authorization: `Bearer ${tokens.access_token}`, accept: "application/json" },
    });
    const profile = await profileResponse.json().catch(() => ({})) as {
      id?: string; displayName?: string; mail?: string; userPrincipalName?: string; error?: { message?: string };
    };
    if (!profileResponse.ok || !profile.id) {
      return oauthError(profile.error?.message ?? "Microsoft Graph could not identify this mailbox.", request, profileResponse.status || 502);
    }
    const emailAddress = (profile.mail || profile.userPrincipalName || "").trim().toLowerCase();
    if (!emailAddress || !emailAddress.includes("@")) {
      return oauthError("Microsoft Graph did not return a usable mailbox email address.", request, 502);
    }

    const capabilities: CapabilitySet = {
      folders: true, labels: false, sync_incremental: true, sync_full: true, sync_webhook: false,
      sync_idle: false, search_server_side: true, search_client_side: true, drafts: false, reply: false,
      forward: false, mark_read: false, archive: false, move: false, threads: true,
      attachments_download: false, attachments_upload: false, send: false,
    };
    const repository = new PostgresEmailAccountRepository();
    if (payload.accountId) {
      const target = await repository.getById(payload.accountId);
      if (!target || target.organization_id !== payload.organizationId || target.provider !== "microsoft_graph") {
        return oauthError("The Outlook reconnect target is invalid.", request, 409);
      }
    }
    const existing = payload.accountId
      ? await repository.getById(payload.accountId)
      : await repository.findByOrganizationProviderAddress(payload.organizationId, "microsoft_graph", emailAddress);
    const account = existing
      ? await repository.updateConnection(existing.id, {
          emailAddress,
          displayName: profile.displayName || emailAddress,
          connectionConfig: { tenantId: payload.tenantId, remoteAccountId: profile.id, oauthClientId: configuredClientId },
          status: "pending",
          capabilities,
        })
      : await repository.create({
          organizationId: payload.organizationId,
          provider: "microsoft_graph",
          emailAddress,
          displayName: profile.displayName || emailAddress,
          connectionConfig: { tenantId: payload.tenantId, remoteAccountId: profile.id, oauthClientId: configuredClientId },
          status: "pending",
          capabilities,
        });
    if (!account) return oauthError("Outlook mailbox could not be persisted.", request, 500);

    const masterKey = signingKey();
    if (!masterKey) return oauthError("Platform credential encryption is not configured.", request, 503);
    await repository.saveCredentials(account.id, "oauth_token", {
      credential_type: "oauth_token",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined,
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      microsoft_tenant_id: payload.tenantId,
      microsoft_client_id: configuredClientId,
      microsoft_client_secret: clientSecret,
      microsoft_user_id: profile.id,
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
      metadata: { provider: "microsoft_graph" },
    });

    const response = NextResponse.redirect(new URL("/mail/accounts?connected=microsoft_graph", safeOrigin(request)), 303);
    response.cookies.set("microsoft_oauth_verifier", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
    response.cookies.set("microsoft_oauth_state", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    return oauthError(error instanceof Error ? error.message : "Microsoft mailbox connection failed.", request, 500);
  }
}
