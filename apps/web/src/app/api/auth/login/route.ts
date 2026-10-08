import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/identity/supabase-adapter";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  if (!email || !password) return NextResponse.json({ error: "validation_error", message: "Email and password are required." }, { status: 400 });

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return NextResponse.json({ error: "configuration_required", message: "Authentication is not configured on this deployment." }, { status: 503 });

  const response = await fetch(new URL("/auth/v1/token?grant_type=password", supabaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", apikey: publishableKey },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; error_description?: string; msg?: string };
  if (!response.ok || !payload.access_token) {
    return NextResponse.json({ error: "invalid_credentials", message: "Email or password is incorrect." }, { status: 401 });
  }

  const result = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  result.cookies.set(ACCESS_TOKEN_COOKIE, payload.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 });
  if (payload.refresh_token) result.cookies.set("aca-refresh-token", payload.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return result;
}
