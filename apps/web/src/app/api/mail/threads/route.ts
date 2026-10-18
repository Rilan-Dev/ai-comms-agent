import { NextResponse } from "next/server";
import { listMailThreadsForOrganization } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

/** Every page request is reauthorized; the client never supplies the tenant SQL scope unchecked. */
export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required to load email threads." }, { status: 503 });
    }
    await ensureDevSeed();
    const params = new URL(request.url).searchParams;
    const organizationId = params.get("organizationId") ?? "";
    if (!organizationId) {
      return NextResponse.json({ error: "validation_error", message: "Organization is required." }, { status: 400 });
    }
    await authorize(request, {
      organizationId: asOrganizationId(organizationId), permission: "organization.read",
    }, getIdentityAdapter(), getIdentityRepository());

    const limit = Number(params.get("limit") ?? "25");
    const offset = Number(params.get("offset") ?? "0");
    const search = params.get("q")?.trim() ?? "";
    const accountId = params.get("accountId") ?? undefined;
    const unread = params.get("unread") ?? "false";
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 10000 ||
      search.length > 120 || !["true", "false"].includes(unread) ||
      (accountId != null && accountId !== "" && !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(accountId))) {
      return NextResponse.json({ error: "validation_error", message: "Invalid thread filters." }, { status: 422 });
    }
    const result = await listMailThreadsForOrganization(organizationId, {
      accountId, search, unreadOnly: unread === "true", limit, offset,
    });
    return NextResponse.json({ ...result, limit, offset }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
