import { NextResponse } from "next/server";
import { LocalIdentityAdapter } from "@/lib/identity/local-auth";
import { requireAuthenticatedUser } from "@/lib/identity/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request, new LocalIdentityAdapter());
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      return NextResponse.json({ error: "unauthorized", message: error.message }, { status: 401 });
    }
    console.error("[auth/me]", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
