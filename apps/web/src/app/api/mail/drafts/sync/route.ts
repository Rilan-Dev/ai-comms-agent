import { NextResponse } from "next/server";
import { queueLocalDraftProviderSyncForOrganization, getLocalDraftForOrganization, PostgresEmailAccountRepository, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for provider draft synchronization." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const messageId = typeof body?.messageId === "string" ? body.messageId : "";
    if (!organizationId || !messageId) return NextResponse.json({ error: "validation_error", message: "Organization and draft are required." }, { status: 422 });
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "email.write" }, getIdentityAdapter(), getIdentityRepository());
    const draft = await getLocalDraftForOrganization(organizationId, messageId);
    if (!draft) return NextResponse.json({ error: "not_found", message: "Draft was not found in this organization." }, { status: 404 });
    const account = await new PostgresEmailAccountRepository().getById(String(draft.email_account_id));
    if (!account || account.organization_id !== organizationId) return NextResponse.json({ error: "not_found", message: "Sending mailbox was not found in this organization." }, { status: 404 });
    if (account.status !== "connected") return NextResponse.json({ error: "account_not_connected", message: "Connect the sending mailbox before requesting provider draft synchronization." }, { status: 409 });
    if (!account.capabilities.drafts) return NextResponse.json({ error: "capability_not_supported", message: "This provider does not support remote drafts." }, { status: 409 });
    const queued = await queueLocalDraftProviderSyncForOrganization(organizationId, messageId);
    if (!queued) return NextResponse.json({ error: "conflict", message: "Draft is already queued, currently syncing, locked for approval, or otherwise unavailable for provider synchronization." }, { status: 409 });
    await recordAuditEvent({ organizationId, actorUserId: actor.user.id, eventType: "email.draft.provider_sync_requested", targetType: "email_message", targetId: messageId, action: "sync", decision: "allowed" });
    return NextResponse.json({ queued: true, status: "queued", draftId: messageId });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
