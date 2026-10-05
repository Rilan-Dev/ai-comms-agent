import { NextResponse } from "next/server";
import { PostgresAgentRepository, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const orgId = new URL(request.url).searchParams.get("organizationId") ?? "";
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    await authorize(request, { organizationId: asOrganizationId(orgId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const repo = new PostgresAgentRepository();
    const [emailBindings, whatsappBinding] = await Promise.all([repo.emailBindings(orgId, id), repo.whatsappBinding(orgId, id)]);
    return NextResponse.json({ emailBindings, whatsappBinding });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const orgId = typeof body?.organizationId === "string" ? body.organizationId : "";
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
    const repo = new PostgresAgentRepository();
    if (typeof body?.emailAccountId === "string" && body.emailAccountId.trim()) {
      const role = body?.emailRole === "read_only" || body?.emailRole === "send_only" ? body.emailRole : "primary";
      await repo.bindEmail(orgId, id, body.emailAccountId.trim(), role);
      await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, agentId: id, eventType: "agent.email_binding_updated", targetType: "agent_email_account", action: "bind", decision: "allowed", metadata: { emailAccountId: body.emailAccountId.trim(), role } });
    }
    if (typeof body?.whatsappAccountId === "string" && body.whatsappAccountId.trim()) {
      await repo.bindWhatsApp(orgId, id, body.whatsappAccountId.trim());
      await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, agentId: id, eventType: "agent.whatsapp_binding_updated", targetType: "agent_whatsapp_account", action: "bind", decision: "allowed", metadata: { whatsappAccountId: body.whatsappAccountId.trim() } });
    }
    const [emailBindings, whatsappBinding] = await Promise.all([repo.emailBindings(orgId, id), repo.whatsappBinding(orgId, id)]);
    return NextResponse.json({ emailBindings, whatsappBinding });
  } catch (error) { return authorizationErrorToResponse(error); }
}
