import { NextResponse } from "next/server";
import {
  createOrUpdateWhatsAppAccount,
  disconnectWhatsAppAccount,
  listWhatsAppAccountsForOrganization,
  parseCredentialsMasterKey,
  recordAuditEvent,
  saveWhatsAppCredential,
  updateWhatsAppAccountStatus,
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
    return NextResponse.json({ accounts: (await listWhatsAppAccountsForOrganization(organizationId)).filter((account) => account.phone_number_id !== "__webhook_config__") });
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
    const accountId = typeof body?.accountId === "string" ? body.accountId : undefined;
    if (!organizationId || !phoneNumberId || (!accessToken && !accountId)) return NextResponse.json({ error: "validation_error", message: "Organization and Meta phone number ID are required; provide an access token for a new account." }, { status: 422 });
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
    if (!masterKey) return NextResponse.json({ error: "provider_configuration_required", message: "Credential encryption is not configured on the server." }, { status: 503 });
    const existingCredential = !accessToken && accountId ? await (async () => { try { const value = await (await import("@ai-comms-agent/db")).loadWhatsAppCredential(accountId, organizationId, masterKey); return value; } catch { return null; } })() : null;
    const effectiveAccessToken = accessToken || (typeof existingCredential?.access_token === "string" ? existingCredential.access_token : "");
    if (!effectiveAccessToken) return NextResponse.json({ error: "validation_error", message: "The saved access token could not be loaded. Enter a new access token and try again." }, { status: 422 });
    const account = await createOrUpdateWhatsAppAccount({ organizationId, accountId, businessAccountId: typeof body?.businessAccountId === "string" ? body.businessAccountId : null, phoneNumberId, phoneNumber: typeof body?.phoneNumber === "string" ? body.phoneNumber : null, displayName: typeof body?.displayName === "string" ? body.displayName : null, verifyToken: typeof body?.verifyToken === "string" ? body.verifyToken.trim() : undefined, status: "pending", createdBy: actor.user.id });
    if (!account) return NextResponse.json({ error: "not_found", message: "WhatsApp account could not be saved." }, { status: 404 });
    // Store access_token + app_secret in the encrypted credential envelope.
    // The app_secret is used by the webhook POST route to verify Meta's
    // x-hub-signature-256 HMAC — no longer requires WHATSAPP_APP_SECRET env var.
    const credentialPayload: Record<string, unknown> = { ...(existingCredential ?? {}), credential_type: "oauth_token", access_token: effectiveAccessToken };
    if (typeof body?.appSecret === "string" && body.appSecret.trim()) credentialPayload.app_secret = body.appSecret.trim();
    await saveWhatsAppCredential(account.id, organizationId, credentialPayload, masterKey);

    // Verify immediately after saving so a missing/paused worker cannot leave a
    // valid account pending forever. A connected status is only set after Meta
    // accepts the token and returns the phone-number resource.
    let verifiedAccount = { ...account, status: "pending" as string, last_error: null as string | null };
    try {
      const version = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
      const url = new URL(version + "/" + encodeURIComponent(phoneNumberId) + "?fields=display_phone_number,verified_name", "https://graph.facebook.com/");
      const response = await fetch(url, { headers: { authorization: "Bearer " + effectiveAccessToken }, cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { error?: { message?: unknown; code?: unknown }; display_phone_number?: unknown; verified_name?: unknown };
      if (!response.ok) {
        const providerMessage = typeof payload.error?.message === "string" ? payload.error.message : "Meta could not verify this phone number ID and access token.";
        await updateWhatsAppAccountStatus(organizationId, account.id, "error", providerMessage);
        verifiedAccount = { ...verifiedAccount, status: "error", last_error: providerMessage };
      } else {
        await updateWhatsAppAccountStatus(
          organizationId, account.id, "connected", null,
          typeof payload.display_phone_number === "string" ? payload.display_phone_number : null,
          typeof payload.verified_name === "string" ? payload.verified_name : null,
        );
        verifiedAccount = { ...verifiedAccount, status: "connected", last_error: null,
          phone_number: typeof payload.display_phone_number === "string" ? payload.display_phone_number : account.phone_number,
          display_name: typeof payload.verified_name === "string" ? payload.verified_name : account.display_name };
      }
    } catch (verificationError) {
      const providerMessage = verificationError instanceof Error ? verificationError.message : "Meta verification request failed.";
      await updateWhatsAppAccountStatus(organizationId, account.id, "error", providerMessage);
      verifiedAccount = { ...verifiedAccount, status: "error", last_error: providerMessage };
    }

    await recordAuditEvent({ organizationId, actorUserId: actor.user.id, eventType: "whatsapp.account.saved", targetType: "whatsapp_account", targetId: account.id, action: "save", decision: "allowed", metadata: { verificationStatus: verifiedAccount.status } });
    return NextResponse.json({
      account: verifiedAccount,
      verified: verifiedAccount.status === "connected",
      message: verifiedAccount.status === "connected"
        ? "Credentials saved securely and Meta phone access verified. Webhook subscription and recipient eligibility are separate checks."
        : "Credentials were saved, but Meta verification failed. Review the account error, check the phone number ID, access token, app mode and permissions, then edit and retry.",
    }, { status: 201 });
  } catch (error) {
    console.error("[whatsapp/accounts] POST error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const code = (error as { code?: string })?.code;
    return NextResponse.json({ error: "internal_server_error", message, code }, { status: 500 });
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
