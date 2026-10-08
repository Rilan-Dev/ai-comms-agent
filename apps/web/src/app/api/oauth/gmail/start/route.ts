import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { parseCredentialsMasterKey } from "@ai-comms-agent/db";
import { authorize } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { loadGmailOAuthConfiguration } from "@/lib/oauth/gmail-config";
import { assertOAuthRedirectUriSecure, getOAuthRedirectUri } from "@/lib/oauth/redirect-uri";

export const dynamic = "force-dynamic";

function signingKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_MASTER_KEY;
  return raw ? parseCredentialsMasterKey(raw) : null;
}

function sign(value: string) {
  const key = signingKey();
  if (!key) throw new Error("Platform credential encryption is not configured");
  return createHmac("sha256", key).update(value).digest("base64url");
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: Request) {
  const context = await getAuthenticatedAppContext(request);
  if (!context) return NextResponse.json({ error: "unauthorized", message: "Sign in before connecting Gmail." }, { status: 401 });

  try {
    await authorize(request, { organizationId: context.organizationId as never, role: "admin" }, getIdentityAdapter(), getIdentityRepository());
  } catch {
    return NextResponse.json({ error: "forbidden", message: "Organization admin access is required to connect Gmail." }, { status: 403 });
  }

  const url = new URL(request.url);
  const configId = url.searchParams.get("configId")?.trim() ?? "";
  const accountId = url.searchParams.get("accountId")?.trim() || undefined;
  if (!configId) return NextResponse.json({ error: "oauth_configuration_required", message: "Choose a Gmail OAuth client in Settings before connecting an account." }, { status: 422 });

  const key = signingKey();
  if (!key) return NextResponse.json({
    error: "platform_encryption_key_required",
    message: "The platform credential-encryption key is required to protect OAuth secrets and state. Gmail client IDs and secrets are configured in Settings, not environment variables.",
  }, { status: 503 });

  const config = await loadGmailOAuthConfiguration(context.organizationId, configId);
  if (!config) return NextResponse.json({ error: "oauth_configuration_not_found", message: "The selected Gmail OAuth configuration is unavailable or disabled." }, { status: 404 });

  let redirectUri: string;
  try {
    redirectUri = getOAuthRedirectUri(request, "gmail");
    assertOAuthRedirectUriSecure(redirectUri);
  } catch (error) {
    return NextResponse.json({ error: "https_callback_required", message: error instanceof Error ? error.message : "A valid HTTPS callback is required." }, { status: 400 });
  }

  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const payload = JSON.stringify({
    organizationId: context.organizationId,
    userId: context.user.id,
    configId: config.id,
    redirectUri,
    ...(accountId ? { accountId } : {}),
    nonce,
    exp: Date.now() + 10 * 60_000,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const state = `${encoded}.${sign(encoded)}`;
  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: "https://www.googleapis.com/auth/gmail.modify",
      state,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
    }).toString()}`,
  );
  response.cookies.set("gmail_oauth_verifier", verifier, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/",
  });
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/",
  });
  return response;
}
