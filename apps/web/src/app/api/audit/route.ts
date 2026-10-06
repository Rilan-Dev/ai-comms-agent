import { NextResponse } from "next/server";
import { listOrganizationAuditEvents } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getDevOrgId, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for audit history." }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const rawId = url.searchParams.get("organizationId")?.trim() || getDevOrgId();
    if (!rawId) return NextResponse.json({ error: "configuration_required", message: "An organization context is required." }, { status: 422 });

    await authorize(request, { organizationId: asOrganizationId(rawId), permission: "audit.read" }, getIdentityAdapter(), getIdentityRepository());

    const limitValue = Number(url.searchParams.get("limit") ?? "50");
    const events = await listOrganizationAuditEvents(rawId, Number.isFinite(limitValue) ? limitValue : 50, {
      eventType: url.searchParams.get("eventType")?.trim() || undefined,
      decision: url.searchParams.get("decision")?.trim() || undefined,
      actorUserId: url.searchParams.get("actorUserId")?.trim() || undefined,
      search: url.searchParams.get("search")?.trim() || undefined,
      from: url.searchParams.get("from")?.trim() || undefined,
      to: url.searchParams.get("to")?.trim() || undefined,
    });
    return NextResponse.json({ events });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
