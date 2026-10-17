import { NextResponse } from "next/server";
import { query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

/** Organization-scoped approval queue. Returned actions are proposals, never evidence of delivery. */
export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", message: "organizationId is required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const actions = await query<{
      id: string; whatsapp_account_id: string; recipient_phone: string; message_body: string;
      payload_type: string; status: string; requested_by: string | null; correlation_id: string;
      expires_at: string; created_at: string;
    }>(
      `SELECT id, whatsapp_account_id, recipient_phone, message_body, payload_type, status,
              requested_by, correlation_id, expires_at, created_at
       FROM whatsapp_send_actions
       WHERE organization_id=$1 AND status IN ('pending','requires_template')
       ORDER BY created_at DESC LIMIT 100`,
      [organizationId],
    );
    return NextResponse.json({ actions: actions.rows.map((action) => ({
      ...action,
      recipient_phone: action.recipient_phone.replace(/\\d(?=\\d{4})/g, "•"),
      message_body: action.message_body.slice(0, 4096),
    })) });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
