import { NextResponse } from "next/server";
import { getWhatsAppAccountForOrganization, listWhatsAppMessagesForOrganization, queueWhatsAppOutboundMessage, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const accountId = url.searchParams.get("accountId") ?? "";
    if (!organizationId || !accountId) return NextResponse.json({ error: "validation_error", message: "organizationId and accountId are required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    return NextResponse.json({ messages: await listWhatsAppMessagesForOrganization(organizationId, accountId) });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const accountId = typeof body?.accountId === "string" ? body.accountId : "";
    const to = typeof body?.to === "string" ? body.to.trim() : "";
    const messageBody = typeof body?.body === "string" ? body.body.trim() : "";
    if (!organizationId || !accountId || !/^\+[1-9]\d{7,14}$/.test(to) || !messageBody || messageBody.length > 4096) return NextResponse.json({ error: "validation_error", message: "Organization, account, E.164 recipient and a message up to 4096 characters are required." }, { status: 422 });
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const account = await getWhatsAppAccountForOrganization(organizationId, accountId);
    if (!account) return NextResponse.json({ error: "not_found", message: "WhatsApp account was not found." }, { status: 404 });
    if (account.status !== "connected") return NextResponse.json({ error: "provider_not_connected", message: "WhatsApp account must be verified and connected before outbound messages can be queued." }, { status: 409 });
    const requestedIdempotencyKey = request.headers.get("Idempotency-Key") ?? (typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "");
    const idempotencyKey = requestedIdempotencyKey.trim();
    if (idempotencyKey.length > 200) return NextResponse.json({ error: "validation_error", message: "Idempotency-Key must be 200 characters or fewer." }, { status: 422 });
    const effectiveIdempotencyKey = idempotencyKey || crypto.randomUUID();
    const messageId = await queueWhatsAppOutboundMessage({ organizationId, accountId, to, body: messageBody, idempotencyKey: effectiveIdempotencyKey });
    if (!messageId) return NextResponse.json({ queued: false, message: "This outbound message was already queued with the same idempotency key." });
    await recordAuditEvent({ organizationId, actorUserId: actor.user.id, eventType: "whatsapp.message.queued", targetType: "whatsapp_message", targetId: messageId, action: "send", decision: "allowed" });
    return NextResponse.json({ queued: true, messageId, status: "queued" }, { status: 202 });
  } catch (error) { return authorizationErrorToResponse(error); }
}
