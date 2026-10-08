import { NextResponse } from "next/server";
import { LocalIdentityAdapter, ValidationError, InvalidCredentialsError, assertSameOrigin, changePassword, getSessionTokenHash } from "@/lib/identity/local-auth";
import { requireAuthenticatedUser } from "@/lib/identity/authorization";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAuthenticatedUser(request, new LocalIdentityAdapter());
    const body = await request.json().catch(() => null) as { currentPassword?: unknown; newPassword?: unknown } | null;
    if (typeof body?.currentPassword !== "string" || typeof body?.newPassword !== "string") {
      throw new ValidationError("Current password and new password are required.");
    }
    const sessionTokenHash = getSessionTokenHash(request);
    if (!sessionTokenHash) return NextResponse.json({ error: "unauthorized", message: "Authentication required" }, { status: 401 });
    await changePassword({ userId: user.id, currentPassword: body.currentPassword, newPassword: body.newPassword, currentSessionTokenHash: sessionTokenHash });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    if (error instanceof InvalidCredentialsError) return NextResponse.json({ error: error.code, message: error.message }, { status: 401 });
    if (error instanceof Error && error.name === "UnauthorizedError") return NextResponse.json({ error: "unauthorized", message: error.message }, { status: 401 });
    console.error("[auth/change-password]", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
