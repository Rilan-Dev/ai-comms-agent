import {requireConfigurationWorkflow} from '@/lib/agents/configuration-write-boundary';
import { NextResponse } from "next/server";
import { PostgresAgentRepository, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for persisted agents." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const orgId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const versionId = typeof body?.versionId === "string" ? body.versionId : "";
    const environment = body?.environment === "preview" ? "preview" : body?.environment === "production" ? "production" : "";
    if (!orgId || !versionId || !environment) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: !orgId ? "Organization is required." : undefined, versionId: !versionId ? "Version is required." : undefined, environment: !environment ? "Environment is required." : undefined } }, { status: 400 });
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "owner" }, getIdentityAdapter(), getIdentityRepository());
    const workflowRequired=requireConfigurationWorkflow();if(workflowRequired)return workflowRequired;
    const deployment = await new PostgresAgentRepository().deploy(orgId, id, subject.user.id, versionId, environment);
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, agentId: id, eventType: "agent.deployed", targetType: "agent_deployment", targetId: deployment.id, action: "deploy", decision: "allowed", metadata: { environment, versionId } });
    return NextResponse.json({ deployment }, { status: 201 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
