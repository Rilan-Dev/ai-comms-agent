import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { parseCredentialsMasterKey } from "@ai-comms-agent/db";
import { authorize } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertOAuthRedirectUriSecure, getOAuthRedirectUri } from "@/lib/oauth/redirect-uri";

export const dynamic = "force-dynamic";

function signingKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_MASTER_KEY;
  return raw ? parseCredentialsMasterKey(raw) : null;
}

function sign(value: string): string {
  const key = signingKey();
  if (!key) throw new Error("Platform credential-encryption key is not configured.");
  return createHmac("sha256", key).update(value).digest("base64url");
}

export async function GET(request: Request) {
  const appContext = await getAuthenticatedAppContext(request);
  if (!appContext) return NextResponse.json({ error: "unauthorized", message: "Sign in before connecting Outlook." }, { status: 401 });
  try {
    await authorize(request, { organizationId: appContext.organizationId as never, role: "admin" }, getIdentityAdapter(), getIdentityRepository());
  } catch {
    return NextResponse.json({ error: "forbidden", message: "Organization admin access is required to connect Outlook." }, { status: 403 });
  }

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const tenantId = process.env.MICROSOFT_OAUTH_TENANT_ID?.trim() || "common";
  const key = signingKey();
  if (!clientId || !process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim()) {
    return NextResponse.json({ error: "oauth_configuration_required", message: "Configure MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET in server-side settings." }, { status: 503 });
  }
  if (!key) return NextResponse.json({ error: "platform_encryption_key_required" }, { status: 503 });

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim() || undefined;
  let redirectUri: string;
  try {
    redirectUri = getOAuthRedirectUri(request, "microsoft");
    assertOAuthRedirectUriSecure(redirectUri);
  } catch (error) {
    return NextResponse.json({ error: "https_callback_required", message: error instanceof Error ? error.message : "A valid HTTPS callback is required." }, { status: 400 });
  }

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const payload = JSON.stringify({
    organizationId: appContext.organizationId,
    userId: appContext.user.id,
    tenantId,
    clientId,
    redirectUri,
    ...(accountId ? { accountId } : {}),
    nonce: randomBytes(16).toString("base64url"),
    exp: Date.now() + 10 * 60_000,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const state = `${encoded}.${sign(encoded)}`;
  const authorizationUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize`);
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    response_mode: "query",
    redirect_uri: redirectUri,
    scope: "openid profile offline_access User.Read Mail.Read",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("microsoft_oauth_verifier", verifier, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/",
  });
  response.cookies.set("microsoft_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/",
  });
  return response;
}
