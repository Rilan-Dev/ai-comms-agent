import { NextResponse } from "next/server";
import { PostgresAgentRepository, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { validateAgentPolicyInput } from "@/lib/agents/validation";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
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
    // A first-party chat/settings preview includes its original policy.
    // The repository compares all persisted fields atomically; a concurrent
    // change must be reviewed, never overwritten after a stale confirmation.
    if (body?.expectedPolicy !== undefined &&
        (!body.expectedPolicy || typeof body.expectedPolicy !== "object" || Array.isArray(body.expectedPolicy))) {
      return NextResponse.json({
        error: "validation_error", fieldErrors: { expectedPolicy: "A saved policy snapshot is required." },
      }, { status: 422 });
    }
    const expectedValidation = body?.expectedPolicy === undefined
      ? null : validateAgentPolicyInput(body.expectedPolicy);
    if (expectedValidation && !expectedValidation.ok) {
      return NextResponse.json({ error: "validation_error", fieldErrors: expectedValidation.fieldErrors }, { status: 422 });
    }
    const repo = new PostgresAgentRepository();
    const policy = await repo.updatePolicy(orgId, id, input, expectedValidation?.value);
    if (!policy) {
      const current = await repo.policy(orgId, id);
      if (current && expectedValidation) return NextResponse.json({
        error: "policy_changed",
        message: "Agent permissions changed in another session. Reload the current policy, review your choices, and confirm again.",
      }, { status: 409 });
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, agentId: id, eventType: "agent.policy_updated", targetType: "agent_policy", targetId: policy.id, action: "update", decision: "allowed" });
    return NextResponse.json({ policy });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

/** Only an organization administrator may inspect full policy restrictions.
 * Chat can display a permission preview, but never grants access on read. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", message: "Organization is required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
    const policy = await new PostgresAgentRepository().policy(organizationId, id);
    if (!policy) return NextResponse.json({ error: "not_found", message: "No saved agent policy exists." }, { status: 404 });
    return NextResponse.json({ policy }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
