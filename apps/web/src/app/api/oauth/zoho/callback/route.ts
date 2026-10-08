import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { PostgresEmailAccountRepository, parseCredentialsMasterKey, recordAuditEvent } from "@ai-comms-agent/db";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { loadZohoOAuthConfiguration } from "@/lib/oauth/zoho-config";
import { assertOAuthRedirectUriSecure, getOAuthRedirectUri } from "@/lib/oauth/redirect-uri";
import { authorize } from "@/lib/identity/authorization";

export const dynamic = "force-dynamic";

const ACCOUNT_DOMAINS: Record<string, string> = {
  us: "https://accounts.zoho.com",
  eu: "https://accounts.zoho.eu",
  in: "https://accounts.zoho.in",
  au: "https://accounts.zoho.au",
  ca: "https://accounts.zohocloud.ca",
  jp: "https://accounts.zoho.jp",
  sa: "https://accounts.zoho.sa",
};

function normalizeZohoApiDomain(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    const allowed = [
      /^mail\\.zoho\\.(com|eu|in|au|jp|sa)$/,
      /^mail\\.zohocloud\\.ca$/,
    ];
    if (!allowed.some((pattern) => pattern.test(url.hostname))) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function verify(encoded: string, signature: string) {
  const raw = process.env.CREDENTIALS_MASTER_KEY;
  if (!raw) return false;
  const secret = parseCredentialsMasterKey(raw);
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
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
  const cookie = request.headers.get("cookie") ?? "";
  const verifier = cookie.match(/(?:^|; )zoho_oauth_verifier=([^;]+)/)?.[1];
  const stateCookie = cookie.match(/(?:^|; )zoho_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || !verifier || !stateCookie || stateCookie !== state) {
    return oauthError("The Zoho authorization session is incomplete or invalid.", request);
  }

  const [encoded, signature] = state.split(".");
  if (!encoded || !signature || !verify(encoded, signature)) return oauthError("Invalid Zoho OAuth state.", request);

  let payload: { organizationId: string; userId: string; configId: string; redirectUri: string; accountId?: string; dataCenter: string; exp: number };
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return oauthError("Invalid Zoho OAuth state.", request);
  }
  if (!payload.organizationId || !payload.userId || !payload.configId || !payload.redirectUri || payload.exp < Date.now()) return oauthError("Zoho OAuth state has expired.", request);

  const accountsDomain = ACCOUNT_DOMAINS[payload.dataCenter];
  const oauthConfig = await loadZohoOAuthConfiguration(payload.organizationId, payload.configId).catch(() => null);
  if (!accountsDomain || !oauthConfig || oauthConfig.dataCenter !== payload.dataCenter) return oauthError("The selected Zoho OAuth configuration was removed or disabled.", request, 409);
  const clientId = oauthConfig.clientId;
  const clientSecret = oauthConfig.clientSecret;
  let redirectUri: string;
  try {
    redirectUri = getOAuthRedirectUri(request, "zoho");
    if (redirectUri !== payload.redirectUri) return oauthError("The callback host changed during authorization. Restart Zoho connection from the same application URL.", request, 400);
    assertOAuthRedirectUriSecure(redirectUri);
  } catch (error) {
    return oauthError(error instanceof Error ? error.message : "A valid HTTPS callback is required.", request, 400);
  }

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

  try {
    const tokenResponse = await fetch(`${accountsDomain}/oauth/v2/token`, {
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
    if (!tokenResponse.ok) return oauthError("Zoho rejected the authorization code.", request, 502);
    const tokens = await tokenResponse.json() as {
      access_token?: string; refresh_token?: string; expires_in?: number; api_domain?: string;
    };
    if (!tokens.access_token || !tokens.api_domain) return oauthError("Zoho did not return the required token metadata.", request, 502);
    const apiDomain = normalizeZohoApiDomain(tokens.api_domain);
    if (!apiDomain) return oauthError("Zoho returned an untrusted API domain.", request, 502);

    const accountsResponse = await fetch(`${apiDomain}/api/accounts`, {
      headers: { authorization: `Zoho-oauthtoken ${tokens.access_token}`, accept: "application/json" },
    });
    if (!accountsResponse.ok) return oauthError("Zoho account verification failed.", request, 502);
    const accountsPayload = await accountsResponse.json() as {
      data?: Array<{ accountId?: string | number; emailAddress?: string; displayName?: string }>;
    };
    const remote = accountsPayload.data?.[0];
    if (!remote?.accountId || !remote.emailAddress) return oauthError("Zoho did not return a usable mail account.", request, 502);

    const masterKey = process.env.CREDENTIALS_MASTER_KEY
      ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY)
      : null;
    if (!masterKey) return oauthError("Credential encryption is not configured on the server.", request, 503);

    const capabilities = {
      folders: true, labels: true, sync_incremental: false, sync_full: true, sync_webhook: true, sync_idle: false,
      search_server_side: true, search_client_side: true, drafts: false, reply: true, forward: false,
      mark_read: true, archive: true, move: true, threads: true, attachments_download: false,
      attachments_upload: false, send: false,
    };

    const repository = new PostgresEmailAccountRepository();
    if (payload.accountId) {
      const target = await repository.getById(payload.accountId);
      if (!target || target.organization_id !== payload.organizationId || target.provider !== "zoho") {
        return oauthError("The Zoho reconnect target is invalid.", request, 409);
      }
    }
    const existing = payload.accountId
      ? await repository.getById(payload.accountId)
      : await repository.findByOrganizationProviderAddress(payload.organizationId, "zoho", remote.emailAddress);
    const account = existing
      ? await repository.updateConnection(existing.id, {
          emailAddress: remote.emailAddress,
          displayName: remote.displayName ?? remote.emailAddress,
          connectionConfig: {
            apiDomain,
            dataCenter: payload.dataCenter,
            remoteAccountId: String(remote.accountId),
          },
          status: "pending",
          capabilities,
        })
      : await repository.create({
          organizationId: payload.organizationId,
          provider: "zoho",
          emailAddress: remote.emailAddress,
          displayName: remote.displayName ?? remote.emailAddress,
          connectionConfig: {
            apiDomain,
            dataCenter: payload.dataCenter,
            remoteAccountId: String(remote.accountId),
          },
          status: "pending",
          capabilities,
        });
    if (!account) return oauthError("Zoho account could not be persisted.", request, 500);

    await repository.saveCredentials(account.id, "oauth_token", {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined,
      zoho_client_id: clientId,
      zoho_client_secret: clientSecret,
      zoho_config_id: oauthConfig.id,
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

    const response = NextResponse.redirect(new URL("/mail/accounts?connected=zoho", request.url));
    response.cookies.delete("zoho_oauth_verifier");
    response.cookies.delete("zoho_oauth_state");
    return response;
  } catch (error) {
    console.error("[zoho-oauth] callback failed", error);
    return oauthError("Zoho connection could not be completed.", request, 500);
  }
}
