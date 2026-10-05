import { NextResponse } from "next/server";
import { PostgresAgentRepository } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for agent tests." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const repo = new PostgresAgentRepository();
    const agent = await repo.get(organizationId, id);
    if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const [versions, policy, bindings] = await Promise.all([repo.versions(organizationId, id), repo.policy(organizationId, id), repo.emailBindings(organizationId, id)]);
    const current = versions.find((v) => v.id === agent.currentVersionId) ?? versions[0] ?? null;
    const checks = [
      { key: "agent", label: "Agent record exists", ok: true },
      { key: "version", label: "At least one configuration version exists", ok: Boolean(current) },
      { key: "policy", label: "Security policy exists", ok: Boolean(policy) },
      { key: "email", label: "Email channel binding is optional", ok: true, detail: bindings.length ? `${bindings.length} email binding(s)` : "Not connected" },
    ];
    return NextResponse.json({ ok: checks.every((c) => c.ok), checks, agentId: id });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
