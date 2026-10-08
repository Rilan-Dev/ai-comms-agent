import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, InvalidCredentialsError, ValidationError, assertSameOrigin, loginWithPassword, normalizeEmail, normalizeIpAddress, validateEmail } from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
    if (typeof body?.email !== "string" || typeof body?.password !== "string") {
      throw new ValidationError("Email and password are required.");
    }

    const email = normalizeEmail(body.email);
    validateEmail(email);

    const result = await loginWithPassword({
      email,
      password: body.password,
      ipAddress: normalizeIpAddress(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null),
      userAgent: request.headers.get("user-agent"),
    });

    const response = NextResponse.json({ ok: true, user: result.user });
    response.cookies.set(ACCESS_TOKEN_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
    });
    return response;
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    }
    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 401 });
    }
    console.error("[auth/login]", error);
    return NextResponse.json({ error: "internal_server_error", message: "Authentication service is temporarily unavailable." }, { status: 500 });
  }
}
