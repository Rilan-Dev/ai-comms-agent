import { NextResponse } from "next/server";
import { createOrUpdateWhatsAppAccount, getWhatsAppAccountForOrganization, listWhatsAppAccountsForOrganization, parseCredentialsMasterKey, saveWhatsAppCredential, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

const WEBHOOK_CONFIG_PHONE_ID = "__webhook_config__";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", message: "organizationId is required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());

    // Look for the webhook-config pseudo-account
    const accounts = await listWhatsAppAccountsForOrganization(organizationId);
    const configAccount = accounts.find(a => a.phone_number_id === WEBHOOK_CONFIG_PHONE_ID);
    if (!configAccount) {
      return NextResponse.json({ saved: false, verifyToken: "", appSecret: "" });
    }
    // Load the encrypted credentials to get the app_secret
    const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
    let appSecret = "";
    if (masterKey) {
      try {
        const { loadWhatsAppCredential } = await import("@ai-comms-agent/db");
        const cred = await loadWhatsAppCredential(configAccount.id, organizationId, masterKey);
        appSecret = typeof cred?.app_secret === "string" ? cred.app_secret : "";
      } catch {}
    }
    // Get the verify_token from the DB (it's stored in the verify_token column)
    const r = await query<{ verify_token: string | null }>("SELECT verify_token FROM whatsapp_accounts WHERE id = $1 AND organization_id = $2", [configAccount.id, organizationId]);
    const verifyToken = r.rows[0]?.verify_token ?? "";
    return NextResponse.json({ saved: true, verifyToken, appSecret });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const verifyToken = typeof body?.verifyToken === "string" ? body.verifyToken.trim() : "";
    const appSecret = typeof body?.appSecret === "string" ? body.appSecret.trim() : "";
    if (!organizationId || !verifyToken) return NextResponse.json({ error: "validation_error", message: "organizationId and verifyToken are required." }, { status: 422 });
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
    if (!masterKey) return NextResponse.json({ error: "provider_configuration_required", message: "Credential encryption is not configured on the server." }, { status: 503 });

    // Create or update a pseudo-account with phone_number_id = __webhook_config__
    // to store the webhook verify_token + app_secret. This is NOT a real phone —
    // it's a config placeholder. The webhook GET route finds it via
    // findWhatsAppAccountByVerifyToken.
    const account = await createOrUpdateWhatsAppAccount({
      organizationId,
      phoneNumberId: WEBHOOK_CONFIG_PHONE_ID,
      businessAccountId: null,
      phoneNumber: null,
      displayName: "Webhook Configuration",
      verifyToken,
      status: "connected",
      createdBy: actor.user.id,
    });
    if (!account) return NextResponse.json({ error: "not_found", message: "Webhook config could not be saved." }, { status: 404 });

    // Store the app_secret in the encrypted credentials
    const credentialPayload: Record<string, unknown> = { credential_type: "oauth_token", app_secret: appSecret };
    await saveWhatsAppCredential(account.id, organizationId, credentialPayload, masterKey);

    return NextResponse.json({ saved: true, message: "Webhook config saved to database." });
  } catch (error) {
    console.error("[whatsapp/webhook-config] POST error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "internal_server_error", message }, { status: 500 });
  }
}
