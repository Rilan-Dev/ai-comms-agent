import { NextResponse } from "next/server";
import { createLocalDraft, updateLocalDraftForOrganization, getLocalDraftForOrganization, listLocalDraftsForOrganization, deleteLocalDraftForOrganization, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { validateDraftWrite } from "@/lib/mail/draft-write-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for drafts." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const emailAccountId = typeof body?.emailAccountId === "string" ? body.emailAccountId : "";
    if (!organizationId || !emailAccountId) return NextResponse.json({ error: "validation_error", message: "Organization and sending mailbox are required." }, { status: 422 });
    const validated = validateDraftWrite(body, "create");
    if (!validated.ok) return NextResponse.json({ error: "invalid_draft_payload", message: validated.message }, { status: 422 });
    const { to = [], cc = [], bcc = [], subject = "", bodyText = "" } = validated.fields;
    const subjectRef = asOrganizationId(organizationId);
    const subjectUser = await authorize(request, { organizationId: subjectRef, permission: "email.write" }, getIdentityAdapter(), getIdentityRepository());
    const draft = await createLocalDraft({ organizationId, emailAccountId, to, cc, bcc, subject, bodyText });
    await recordAuditEvent({ organizationId, actorUserId: subjectUser.user.id, eventType: "email.draft.created", targetType: "email_message", targetId: String(draft.id), action: "create", decision: "allowed" });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function PATCH(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for drafts." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const messageId = typeof body?.messageId === "string" ? body.messageId : "";
    if (!organizationId || !messageId) return NextResponse.json({ error: "validation_error", message: "Organization and draft are required." }, { status: 422 });
    const validated = validateDraftWrite(body, "patch");
    if (!validated.ok) return NextResponse.json({ error: "invalid_draft_payload", message: validated.message }, { status: 422 });
    const subjectUser = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "email.write" }, getIdentityAdapter(), getIdentityRepository());
    const draft = await updateLocalDraftForOrganization(organizationId, messageId, validated.fields);
    if (!draft) {
      // Do not report a live, approved/queued draft as missing. Mutation is
      // blocked by the atomic repository SQL while human approval is active.
      const existing = await getLocalDraftForOrganization(organizationId, messageId);
      if (existing) return NextResponse.json({ error: "draft_approval_locked", message: "This draft has a pending, executing, or completed send action. Its reviewed content cannot be changed. Check the action status before editing it." }, { status: 409 });
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
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "email.read" }, getIdentityAdapter(), getIdentityRepository());
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
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for drafts." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const messageId = typeof body?.messageId === "string" ? body.messageId : "";
    if (!organizationId || !messageId) return NextResponse.json({ error: "validation_error", message: "Organization and draft are required." }, { status: 422 });
    const subjectUser = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "email.write" }, getIdentityAdapter(), getIdentityRepository());
    const deleted = await deleteLocalDraftForOrganization(organizationId, messageId);
    if (!deleted) {
      const existing = await getLocalDraftForOrganization(organizationId, messageId);
      if (existing) return NextResponse.json({ error: "draft_approval_locked", message: "This draft has a pending, executing, or completed send action. Its reviewed content cannot be changed. Check the action status before deleting it." }, { status: 409 });
      return NextResponse.json({ error: "not_found", message: "Draft was not found in this organization." }, { status: 404 });
    }
    await recordAuditEvent({ organizationId, actorUserId: subjectUser.user.id, eventType: "email.draft.deleted", targetType: "email_message", targetId: messageId, action: "delete", decision: "allowed" });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
