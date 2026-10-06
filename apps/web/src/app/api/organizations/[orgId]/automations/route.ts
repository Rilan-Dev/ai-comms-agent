import { NextResponse } from "next/server";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { createAutomationRule, deleteAutomationRule, listAutomationRules, listAutomationRuns, updateAutomationRule, recordAuditEvent } from "@ai-comms-agent/db";

export const dynamic = "force-dynamic";

function validate(input: any) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const agentId = typeof input?.agentId === "string" ? input.agentId.trim() : "";
  const trigger = input?.trigger && typeof input.trigger === "object" && !Array.isArray(input.trigger) ? input.trigger : null;
  const actions = Array.isArray(input?.actions) ? input.actions : null;
  if (!name || !agentId || !trigger || !actions || actions.length === 0) return { error: "name, agentId, trigger and at least one action are required" };
  if (actions.length > 20) return { error: "at most 20 actions are allowed" };
  return { value: { name, agentId, trigger, actions, conditions: input?.conditions && typeof input.conditions === "object" ? input.conditions : {} } };
}

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    await authorize(request, { organizationId: asOrganizationId(orgId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    return NextResponse.json({ automations: await listAutomationRules(orgId) });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const parsed = validate(await request.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: "validation_error", message: parsed.error }, { status: 400 });
    const rule = await createAutomationRule({ organizationId: orgId, userId: subject.user.id, ...parsed.value });
    if (!rule) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, eventType: "automation.created", targetType: "automation_rule", targetId: rule.id, action: "create", decision: "allowed" });
    return NextResponse.json({ automation: rule }, { status: 201 });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const body = await request.json().catch(() => null);
    const parsed = validate(body);
    if ("error" in parsed) return NextResponse.json({ error: "validation_error", message: parsed.error }, { status: 400 });
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "validation_error", message: "id is required" }, { status: 400 });
    const status = ["active","paused","archived","error"].includes(body?.status) ? body.status : "active";
    const rule = await updateAutomationRule({ organizationId: orgId, id, status, ...parsed.value });
    if (!rule) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, eventType: "automation.updated", targetType: "automation_rule", targetId: id, action: "update", decision: "allowed" });
    return NextResponse.json({ automation: rule });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const ok = await deleteAutomationRule(orgId, id);
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, eventType: "automation.archived", targetType: "automation_rule", targetId: id, action: "archive", decision: "allowed" });
    return NextResponse.json({ ok: true });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function GET_RUNS(request: Request, { params }: { params: Promise<{ orgId: string; ruleId: string }> }) {
  const { orgId, ruleId } = await params;
  return NextResponse.json({ runs: await listAutomationRuns(orgId, ruleId) });
}
