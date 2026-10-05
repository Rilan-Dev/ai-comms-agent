import { NextResponse } from "next/server";
import { PostgresAgentRepository, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for persisted agents." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const orgId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const input = {
      securityPolicy: body?.securityPolicy && typeof body.securityPolicy === "object" ? body.securityPolicy : {},
      allowedTools: Array.isArray(body?.allowedTools) ? body.allowedTools.map(String) : [],
      allowedSenders: Array.isArray(body?.allowedSenders) ? body.allowedSenders.map(String) : [],
      blockedSenders: Array.isArray(body?.blockedSenders) ? body.blockedSenders.map(String) : [],
      rateLimits: body?.rateLimits && typeof body.rateLimits === "object" ? body.rateLimits : {},
    };
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    await authorize(request, { organizationId: asOrganizationId(orgId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
    const policy = await new PostgresAgentRepository().updatePolicy(orgId, id, input);
    if (!policy) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ policy });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
