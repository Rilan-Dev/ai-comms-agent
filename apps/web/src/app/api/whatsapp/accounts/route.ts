import { NextResponse } from "next/server";
import {
  createOrUpdateWhatsAppAccount,
  disconnectWhatsAppAccount,
  listWhatsAppAccountsForOrganization,
  parseCredentialsMasterKey,
  recordAuditEvent,
  saveWhatsAppCredential,
} from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for WhatsApp." }, { status: 503 });
    await ensureDevSeed();
    const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", message: "organizationId is required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    return NextResponse.json({ accounts: await listWhatsAppAccountsForOrganization(organizationId) });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for WhatsApp." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const phoneNumberId = typeof body?.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
    if (!organizationId || !phoneNumberId || !accessToken) return NextResponse.json({ error: "validation_error", message: "Organization, Meta phone number ID, and access token are required." }, { status: 422 });
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
    if (!masterKey) return NextResponse.json({ error: "provider_configuration_required", message: "Credential encryption is not configured on the server." }, { status: 503 });
    const account = await createOrUpdateWhatsAppAccount({ organizationId, accountId: typeof body?.accountId === "string" ? body.accountId : undefined, businessAccountId: typeof body?.businessAccountId === "string" ? body.businessAccountId : null, phoneNumberId, phoneNumber: typeof body?.phoneNumber === "string" ? body.phoneNumber : null, displayName: typeof body?.displayName === "string" ? body.displayName : null, status: "pending", createdBy: actor.user.id });
    if (!account) return NextResponse.json({ error: "not_found", message: "WhatsApp account could not be saved." }, { status: 404 });
    await saveWhatsAppCredential(account.id, organizationId, { credential_type: "oauth_token", access_token: accessToken }, masterKey);
    await recordAuditEvent({ organizationId, actorUserId: actor.user.id, eventType: "whatsapp.account.saved", targetType: "whatsapp_account", targetId: account.id, action: "save", decision: "allowed" });
    return NextResponse.json({ account: { ...account, status: "pending" }, message: "Credentials stored encrypted. Provider verification is still required before this account is marked connected." }, { status: 201 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const accountId = typeof body?.accountId === "string" ? body.accountId : "";
    if (!organizationId || !accountId) return NextResponse.json({ error: "validation_error", message: "organizationId and accountId are required." }, { status: 422 });
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const removed = await disconnectWhatsAppAccount(organizationId, accountId);
    if (!removed) return NextResponse.json({ error: "not_found", message: "WhatsApp account was not found." }, { status: 404 });
    await recordAuditEvent({ organizationId, actorUserId: actor.user.id, eventType: "whatsapp.account.disconnected", targetType: "whatsapp_account", targetId: accountId, action: "disconnect", decision: "allowed" });
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
