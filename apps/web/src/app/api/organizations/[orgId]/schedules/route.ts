import { NextResponse } from "next/server";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { asOrganizationId, nextCronFire } from "@ai-comms-agent/shared";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { createScheduledJob, deleteScheduledJob, listScheduledJobRuns, listScheduledJobs, updateScheduledJob, recordAuditEvent } from "@ai-comms-agent/db";

export const dynamic = "force-dynamic";

function validate(input: any) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const agentId = typeof input?.agentId === "string" ? input.agentId.trim() : "";
  const intent = typeof input?.intent === "string" ? input.intent.trim() : "";
  const cron = typeof input?.cron === "string" && input.cron.trim() ? input.cron.trim() : null;
  const oneFireAt = typeof input?.oneFireAt === "string" && input.oneFireAt ? input.oneFireAt : null;
  const timezone = typeof input?.timezone === "string" && input.timezone.trim() ? input.timezone.trim() : "UTC";
  const catchUpMinutes = Number.isInteger(input?.catchUpMinutes) ? input.catchUpMinutes : 60;
  if (!name || !agentId || !intent) return { error: "name, agentId and intent are required" };
  if ((cron && oneFireAt) || (!cron && !oneFireAt)) return { error: "provide exactly one of cron or oneFireAt" };
  if (cron && cron.split(/\s+/).length !== 5) return { error: "cron must contain exactly five fields" };
  try { if (cron) nextCronFire(cron,new Date(),timezone); } catch { return {error:"Invalid cron expression or timezone."}; }
  if (oneFireAt && Number.isNaN(Date.parse(oneFireAt))) return { error: "oneFireAt must be an ISO date" };
  if (oneFireAt && Date.parse(oneFireAt) <= Date.now()+30_000) return { error: "One-time fire must be at least 30 seconds in the future." };
  if (catchUpMinutes < 0 || catchUpMinutes > 10080) return { error: "catchUpMinutes must be between 0 and 10080" };
  return { value: { name, agentId, intent, cron, oneFireAt, timezone, catchUpMinutes, params: input?.params && typeof input.params === "object" ? input.params : {} } };
}

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    await authorize(request, { organizationId: asOrganizationId(orgId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (jobId) {
      // Run history for one scheduled AI task (execution evidence).
      const runs = await listScheduledJobRuns(orgId, jobId);
      return NextResponse.json({ runs });
    }
    return NextResponse.json({ schedules: await listScheduledJobs(orgId) });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({error:"invalid_origin"},{status:403}); }
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const parsed = validate(await request.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: "validation_error", message: parsed.error }, { status: 400 });
    const job = await createScheduledJob({ organizationId: orgId, userId: subject.user.id, ...parsed.value });
    if (!job) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, eventType: "schedule.created", targetType: "scheduled_job", targetId: job.id, action: "create", decision: "allowed" });
    return NextResponse.json({ schedule: job }, { status: 201 });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({error:"invalid_origin"},{status:403}); }
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
    const job = await updateScheduledJob({ organizationId: orgId, id, status, ...parsed.value });
    if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, eventType: "schedule.updated", targetType: "scheduled_job", targetId: id, action: "update", decision: "allowed" });
    return NextResponse.json({ schedule: job });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({error:"invalid_origin"},{status:403}); }
  try {
    await ensureDevSeed();
    const { orgId } = await params;
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const ok = await deleteScheduledJob(orgId, id);
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await recordAuditEvent({ organizationId: orgId, actorUserId: subject.user.id, eventType: "schedule.archived", targetType: "scheduled_job", targetId: id, action: "archive", decision: "allowed" });
    return NextResponse.json({ ok: true });
  } catch (error) { return authorizationErrorToResponse(error); }
}
