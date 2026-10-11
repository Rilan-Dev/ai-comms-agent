import { NextResponse } from "next/server";
import { PostgresAgentRepository, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { validateAgentPolicyInput } from "@/lib/agents/validation";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for persisted agents." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const orgId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const validation = validateAgentPolicyInput(body ?? {});
    if (!validation.ok) return NextResponse.json({ error: "validation_error", fieldErrors: validation.fieldErrors }, { status: 422 });
    const input = validation.value;
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
    const policy = await new PostgresAgentRepository().updatePolicy(orgId, id, input);
    if (!policy) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, agentId: id, eventType: "agent.policy_updated", targetType: "agent_policy", targetId: policy.id, action: "update", decision: "allowed" });
    return NextResponse.json({ policy });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
