import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { parseCredentialsMasterKey } from "@ai-comms-agent/db";
import { authorize } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { loadZohoOAuthConfiguration } from "@/lib/oauth/zoho-config";
import { assertOAuthRedirectUriSecure, getOAuthRedirectUri } from "@/lib/oauth/redirect-uri";

export const dynamic = "force-dynamic";
const ACCOUNT_DOMAINS: Record<string, string> = {
  us: "https://accounts.zoho.com", eu: "https://accounts.zoho.eu", in: "https://accounts.zoho.in",
  au: "https://accounts.zoho.au", ca: "https://accounts.zohocloud.ca", jp: "https://accounts.zoho.jp",
  sa: "https://accounts.zoho.sa",
};
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
  if (!context) return NextResponse.json({ error: "unauthorized", message: "Sign in before connecting Zoho Mail." }, { status: 401 });
  try {
    await authorize(request, { organizationId: context.organizationId as never, role: "admin" }, getIdentityAdapter(), getIdentityRepository());
  } catch {
    return NextResponse.json({ error: "forbidden", message: "Organization admin access is required to connect Zoho Mail." }, { status: 403 });
  }
  const url = new URL(request.url);
  const configId = url.searchParams.get("configId")?.trim() ?? "";
  const accountId = url.searchParams.get("accountId")?.trim() || undefined;
  if (!configId) return NextResponse.json({ error: "oauth_configuration_required", message: "Choose a Zoho OAuth client in Settings before connecting an account." }, { status: 422 });
  if (!signingKey()) return NextResponse.json({ error: "platform_encryption_key_required", message: "CREDENTIALS_MASTER_KEY is required to protect OAuth secrets and state." }, { status: 503 });
  const config = await loadZohoOAuthConfiguration(context.organizationId, configId);
  if (!config) return NextResponse.json({ error: "oauth_configuration_not_found", message: "The selected Zoho OAuth configuration is unavailable or disabled." }, { status: 404 });
  const accountsDomain = ACCOUNT_DOMAINS[config.dataCenter];
  if (!accountsDomain) return NextResponse.json({ error: "validation_error", message: "The configured Zoho data center is invalid." }, { status: 422 });
  let redirectUri: string;
  try {
    redirectUri = getOAuthRedirectUri(request, "zoho");
    assertOAuthRedirectUriSecure(redirectUri);
  } catch (error) {
    return NextResponse.json({ error: "https_callback_required", message: error instanceof Error ? error.message : "A valid HTTPS callback is required." }, { status: 400 });
  }
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const payload = JSON.stringify({ organizationId: context.organizationId, userId: context.user.id, configId: config.id, redirectUri, ...(accountId ? { accountId } : {}), nonce, dataCenter: config.dataCenter, exp: Date.now() + 10 * 60_000 });
  const encoded = Buffer.from(payload).toString("base64url");
  const state = `${encoded}.${sign(encoded)}`;
  const scope = "ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.ALL,ZohoMail.tags.READ";
  const response = NextResponse.redirect(`${accountsDomain}/oauth/v2/auth?${new URLSearchParams({
    client_id: config.clientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline",
    prompt: "consent", scope, state, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256",
  }).toString()}`);
  response.cookies.set("zoho_oauth_verifier", verifier, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  response.cookies.set("zoho_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
