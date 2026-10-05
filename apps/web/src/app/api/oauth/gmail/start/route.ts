import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureDevSeed, getDevOrgId, getDevUserId } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

function sign(value: string) {
  const secret = process.env.SESSION_SIGNING_KEY;
  if (!secret) throw new Error("SESSION_SIGNING_KEY is not configured");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET() {
  await ensureDevSeed();
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/oauth/gmail/callback`;
  const organizationId = getDevOrgId();
  const userId = getDevUserId();

  if (!clientId || !process.env.SESSION_SIGNING_KEY || !organizationId || !userId) {
    return NextResponse.json({
      error: "provider_configuration_required",
      message: "Gmail OAuth is not configured. Set GMAIL_OAUTH_CLIENT_ID and SESSION_SIGNING_KEY on the server.",
    }, { status: 503 });
  }

  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const payload = JSON.stringify({ organizationId, userId, nonce, exp: Date.now() + 10 * 60_000 });
  const encoded = Buffer.from(payload).toString("base64url");
  const state = `${encoded}.${sign(encoded)}`;

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
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
