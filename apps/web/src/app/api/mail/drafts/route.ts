import { NextResponse } from "next/server";
import { createLocalDraft, updateLocalDraftForOrganization, getLocalDraftForOrganization, listLocalDraftsForOrganization, deleteLocalDraftForOrganization, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for drafts." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const emailAccountId = typeof body?.emailAccountId === "string" ? body.emailAccountId : "";
    const to = Array.isArray(body?.to) ? body.to.filter((v: unknown): v is string => typeof v === "string" && v.includes("@")) : [];
    if (!organizationId || !emailAccountId || to.length === 0) return NextResponse.json({ error: "validation_error", message: "Organization, sending mailbox and at least one recipient are required." }, { status: 422 });
    const subject = typeof body?.subject === "string" ? body.subject : "";
    const bodyText = typeof body?.bodyText === "string" ? body.bodyText : "";
    const subjectRef = asOrganizationId(organizationId);
    const subjectUser = await authorize(request, { organizationId: subjectRef, role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const draft = await createLocalDraft({ organizationId, emailAccountId, to, cc: Array.isArray(body?.cc) ? body.cc : [], bcc: Array.isArray(body?.bcc) ? body.bcc : [], subject, bodyText });
    await recordAuditEvent({ organizationId, actorUserId: subjectUser.user.id, eventType: "email.draft.created", targetType: "email_message", targetId: String(draft.id), action: "create", decision: "allowed" });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for drafts." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const messageId = typeof body?.messageId === "string" ? body.messageId : "";
    if (!organizationId || !messageId) return NextResponse.json({ error: "validation_error", message: "Organization and draft are required." }, { status: 422 });
    const subjectUser = await authorize(request, { organizationId: asOrganizationId(organizationId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const draft = await updateLocalDraftForOrganization(organizationId, messageId, { to: Array.isArray(body?.to) ? body.to : undefined, cc: Array.isArray(body?.cc) ? body.cc : undefined, bcc: Array.isArray(body?.bcc) ? body.bcc : undefined, subject: typeof body?.subject === "string" ? body.subject : undefined, bodyText: typeof body?.bodyText === "string" ? body.bodyText : undefined });
    if (!draft) {
      // Do not report a live, approved/queued draft as missing. Mutation is
      // blocked by the atomic repository SQL while human approval is active.
      const existing = await getLocalDraftForOrganization(organizationId, messageId);
      if (existing) return NextResponse.json({ error: "draft_approval_locked", message: "This draft is awaiting send approval or execution. Reject or finish the action before editing it." }, { status: 409 });
      return NextResponse.json({ error: "not_found", message: "Draft was not found in this organization." }, { status: 404 });
    }
    await recordAuditEvent({ organizationId, actorUserId: subjectUser.user.id, eventType: "email.draft.updated", targetType: "email_message", targetId: messageId, action: "update", decision: "allowed" });
    return NextResponse.json({ draft });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}


export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for drafts." }, { status: 503 });
    await ensureDevSeed();
    const params = new URL(request.url).searchParams;
    const organizationId = params.get("organizationId") ?? "";
    const messageId = params.get("draftId") ?? "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", message: "Organization is required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    if (messageId) {
      const draft = await getLocalDraftForOrganization(organizationId, messageId);
      if (!draft) return NextResponse.json({ error: "not_found", message: "Draft was not found in this organization." }, { status: 404 });
      return NextResponse.json({ draft });
    }
    return NextResponse.json({ drafts: await listLocalDraftsForOrganization(organizationId) });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for drafts." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const messageId = typeof body?.messageId === "string" ? body.messageId : "";
    if (!organizationId || !messageId) return NextResponse.json({ error: "validation_error", message: "Organization and draft are required." }, { status: 422 });
    const subjectUser = await authorize(request, { organizationId: asOrganizationId(organizationId), role: "member" }, getIdentityAdapter(), getIdentityRepository());
    const deleted = await deleteLocalDraftForOrganization(organizationId, messageId);
    if (!deleted) {
      const existing = await getLocalDraftForOrganization(organizationId, messageId);
      if (existing) return NextResponse.json({ error: "draft_approval_locked", message: "This draft is awaiting send approval or execution. Reject or finish the action before deleting it." }, { status: 409 });
      return NextResponse.json({ error: "not_found", message: "Draft was not found in this organization." }, { status: 404 });
    }
    await recordAuditEvent({ organizationId, actorUserId: subjectUser.user.id, eventType: "email.draft.deleted", targetType: "email_message", targetId: messageId, action: "delete", decision: "allowed" });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
