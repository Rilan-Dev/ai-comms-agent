import { NextResponse } from "next/server";
import { getMailThreadForOrganization } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for mail." }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const threadId = url.searchParams.get("threadId") ?? "";
    if (!organizationId || !threadId) return NextResponse.json({ error: "validation_error", message: "organizationId and threadId are required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "email.read" }, getIdentityAdapter(), getIdentityRepository());
    return NextResponse.json({ messages: await getMailThreadForOrganization(organizationId, threadId) });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
