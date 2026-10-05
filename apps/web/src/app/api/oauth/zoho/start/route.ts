import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureDevSeed, getDevOrgId, getDevUserId } from "@/lib/identity/repository";

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

function sign(value: string) {
  const secret = process.env.SESSION_SIGNING_KEY;
  if (!secret) throw new Error("SESSION_SIGNING_KEY is not configured");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: Request) {
  await ensureDevSeed();
  const clientId = process.env.ZOHO_OAUTH_CLIENT_ID;
  const dataCenter = (process.env.ZOHO_OAUTH_DATA_CENTER ?? "in").toLowerCase();
  const accountsDomain = ACCOUNT_DOMAINS[dataCenter];
  const redirectUri = process.env.ZOHO_OAUTH_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/oauth/zoho/callback`;
  const organizationId = getDevOrgId();
  const userId = getDevUserId();
  const accountId = new URL(request.url).searchParams.get("accountId") || undefined;

  if (!clientId || !accountsDomain || !process.env.SESSION_SIGNING_KEY || !organizationId || !userId) {
    return NextResponse.json({
      error: "provider_configuration_required",
      message: "Zoho OAuth is not configured. Set ZOHO_OAUTH_CLIENT_ID, ZOHO_OAUTH_DATA_CENTER and SESSION_SIGNING_KEY on the server.",
    }, { status: 503 });
  }

  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const payload = JSON.stringify({ organizationId, userId, ...(accountId ? { accountId } : {}), nonce, dataCenter, exp: Date.now() + 10 * 60_000 });
  const encoded = Buffer.from(payload).toString("base64url");
  const state = `${encoded}.${sign(encoded)}`;

  const scope = "ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.ALL,ZohoMail.tags.READ";
  const response = NextResponse.redirect(
    `${accountsDomain}/oauth/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope,
      state,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
    }).toString()}`,
  );

  response.cookies.set("zoho_oauth_verifier", verifier, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/",
  });
  response.cookies.set("zoho_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/",
  });
  return response;
}
