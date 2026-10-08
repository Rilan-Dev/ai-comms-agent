import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, assertSameOrigin, revokeCurrentSession, ValidationError } from "@/lib/identity/local-auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await revokeCurrentSession(request);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    }
    console.error("[auth/logout]", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", expires: new Date(0), path: "/" });
  return response;
}
