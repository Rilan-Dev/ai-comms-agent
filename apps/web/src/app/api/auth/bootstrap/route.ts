import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { PostgresAuthRepository } from "@ai-comms-agent/db";
import { assertSameOrigin, ValidationError, validateEmail, validatePasswordForCreation } from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";

function equalSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const configuredToken = process.env.AUTH_BOOTSTRAP_TOKEN;
    if (!configuredToken || configuredToken.length < 32) {
      return NextResponse.json({ error: "not_configured", message: "Initial authentication bootstrap is not enabled." }, { status: 404 });
    }

    const body = await request.json().catch(() => null) as {
      token?: unknown; email?: unknown; password?: unknown; name?: unknown; organizationName?: unknown; organizationSlug?: unknown; productName?: unknown;
    } | null;

    if (typeof body?.token !== "string" || !equalSecret(body.token, configuredToken)) {
      return NextResponse.json({ error: "unauthorized", message: "Invalid bootstrap credentials." }, { status: 401 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const organizationName = typeof body.organizationName === "string" ? body.organizationName.trim() : "";
    const organizationSlug = typeof body.organizationSlug === "string" ? body.organizationSlug.trim().toLowerCase() : "";
    const productName = typeof body.productName === "string" ? body.productName.trim().slice(0, 80) : "";

    if (!email || !name || !organizationName || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(organizationSlug)) {
      throw new ValidationError("Email, name, organization name, and a valid organization slug are required.");
    }
    if (typeof body.password !== "string") throw new ValidationError("Password is required.");

    validateEmail(email);
    validatePasswordForCreation(body.password);

    const auth = new PostgresAuthRepository();
    if (await auth.countCredentials() > 0) {
      return NextResponse.json({ error: "already_initialized", message: "Initial authentication is already initialized." }, { status: 409 });
    }

    const { hashPasswordForStorage } = await import("@/lib/identity/local-auth");
    const result = await auth.bootstrapInitialAccount({
      email,
      name,
      passwordHash: await hashPasswordForStorage(body.password),
      organizationName,
      organizationSlug,
      productName: productName || null,
    });

    return NextResponse.json({ ok: true, userId: result.userId, organizationId: result.organizationId });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    console.error("[auth/bootstrap]", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
