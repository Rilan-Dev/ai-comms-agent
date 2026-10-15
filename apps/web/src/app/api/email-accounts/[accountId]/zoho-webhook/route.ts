import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  parseCredentialsMasterKey,
  PostgresEmailAccountRepository,
  query,
  recordAuditEvent,
} from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { getOAuthPublicOrigin } from "@/lib/oauth/redirect-uri";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    if (!process.env.DATABASE_URL || !process.env.CREDENTIALS_MASTER_KEY) {
      return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
    }
    const body = await request.json().catch(() => null) as { organizationId?: unknown } | null;
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const { accountId } = await context.params;
    if (!organizationId || !accountId) {
      return NextResponse.json({ error: "validation_error", message: "Organization and mailbox are required." }, { status: 422 });
    }

    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), role: "admin" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );
    const repository = new PostgresEmailAccountRepository();
    const account = await repository.getById(accountId);
    if (!account || account.organization_id !== organizationId || account.provider !== "zoho") {
      return NextResponse.json({ error: "not_found", message: "Zoho mailbox was not found in this organization." }, { status: 404 });
    }
    if (account.status === "revoked" || account.status === "disconnected") {
      return NextResponse.json({ error: "reconnect_required", message: "Reconnect this Zoho mailbox before configuring its webhook." }, { status: 409 });
    }

    let origin: string;
    try { origin = getOAuthPublicOrigin(request); }
    catch { return NextResponse.json({ error: "public_origin_not_configured", message: "Configure APP_ORIGIN before generating a Zoho webhook URL." }, { status: 503 }); }

    const masterKey = parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY);
    const credentials = await repository.loadCredentials(account.id, masterKey);
    if (!credentials) {
      return NextResponse.json({ error: "credentials_missing", message: "Reconnect the Zoho mailbox before configuring its webhook." }, { status: 409 });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await query(
      `UPDATE email_accounts
          SET connection_config=(COALESCE(connection_config,'{}'::jsonb) || $1::jsonb),
              updated_at=now()
        WHERE id=$2 AND organization_id=$3 AND provider='zoho' AND deleted_at IS NULL`,
      [JSON.stringify({ zohoWebhookTokenHash: tokenHash, zohoWebhookCreatedAt: new Date().toISOString() }), account.id, organizationId],
    );

    // Clear any old HMAC secret only after the endpoint token has rotated in
    // the database. If credential persistence fails, the old URL is already invalid.
    const { zoho_webhook_secret: _oldWebhookSecret, ...credentialsWithoutWebhookSecret } = credentials;
    await repository.saveCredentials(account.id, "oauth_token", { ...credentialsWithoutWebhookSecret }, masterKey);
    const webhookUrl = new URL(`/api/webhooks/zoho/${token}`, origin).toString();

    await recordAuditEvent({
      organizationId,
      actorUserId: subject.user.id,
      eventType: "email.account.zoho_webhook_created",
      targetType: "email_account",
      targetId: account.id,
      action: "configure_webhook",
      decision: "allowed",
    });

    return NextResponse.json({
      ok: true,
      webhookUrl,
      message: "Copy this URL into Zoho Mail Settings → Integrations → Developer Space → Outgoing Webhooks. Treat the URL as a secret; it is shown only once. The first signed request bootstraps the per-account HMAC secret.",
      provider: "zoho",
      accountId: account.id,
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
