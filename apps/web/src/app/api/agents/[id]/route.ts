import { NextResponse } from "next/server";
import { PostgresAgentRepository, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { validateAgentInput } from "@/lib/agents/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for persisted agents." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const orgId = new URL(request.url).searchParams.get("organizationId");
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    await authorize(request, { organizationId: asOrganizationId(orgId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const agent = await new PostgresAgentRepository().get(orgId, id);
    if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const repo = new PostgresAgentRepository();
    const [versions, policy, emailBindings] = await Promise.all([repo.versions(orgId, id), repo.policy(orgId, id), repo.emailBindings(orgId, id)]);
    return NextResponse.json({ agent, versions, policy, emailBindings });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for persisted agents." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const orgId = typeof body?.organizationId === "string" ? body.organizationId : "";
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
    const validation = validateAgentInput(body ?? {});
    if (!validation.ok) return NextResponse.json({ error: "validation_error", fieldErrors: validation.fieldErrors }, { status: 422 });
    const agent = await new PostgresAgentRepository().update(orgId, id, validation.value);
    if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, agentId: agent.id, eventType: "agent.updated", targetType: "agent", targetId: agent.id, action: "update", decision: "allowed" });
    return NextResponse.json({ agent });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for persisted agents." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const orgId = typeof body?.organizationId === "string" ? body.organizationId : "";
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "owner" }, getIdentityAdapter(), getIdentityRepository());
    const agent = await new PostgresAgentRepository().retire(orgId, id);
    if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, agentId: agent.id, eventType: "agent.paused", targetType: "agent", targetId: agent.id, action: "pause", decision: "allowed" });
    return NextResponse.json({ agent });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
