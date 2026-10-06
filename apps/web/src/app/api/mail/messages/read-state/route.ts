import { NextResponse } from "next/server";
import { updateMailReadStateForOrganization, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for mail mutations." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null) as { organizationId?: unknown; messageIds?: unknown; isRead?: unknown } | null;
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", message: "Organization is required." }, { status: 400 });
    const messageIds = Array.isArray(body?.messageIds) ? body.messageIds.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) : [];
    if (messageIds.length < 1 || messageIds.length > 100) return NextResponse.json({ error: "validation_error", message: "Provide between 1 and 100 message IDs." }, { status: 422 });
    if (typeof body?.isRead !== "boolean") return NextResponse.json({ error: "validation_error", message: "isRead must be a boolean." }, { status: 422 });
    const orgId = asOrganizationId(organizationId);
    const subject = await authorize(request, { organizationId: orgId, permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const updated = await updateMailReadStateForOrganization(organizationId, messageIds, body.isRead);
    await recordAuditEvent({ organizationId, actorUserId: subject.user.id, eventType: "mail.read_state_updated", targetType: "email_message", action: body.isRead ? "mark_read" : "mark_unread", decision: "allowed", metadata: { requested: messageIds.length, updated } });
    return NextResponse.json({ updated, isRead: body.isRead });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
