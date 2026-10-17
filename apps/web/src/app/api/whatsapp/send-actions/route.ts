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
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "whatsapp.read" }, getIdentityAdapter(), getIdentityRepository());
    const actions = await query<{
      id: string; whatsapp_account_id: string; recipient_phone: string; message_body: string;
      payload_type: string; template_name: string | null; template_language: string | null;
      template_parameters: unknown; template_components: unknown; status: string;
      requested_by: string | null; correlation_id: string; expires_at: string; created_at: string;
    }>(
      `SELECT a.id, a.whatsapp_account_id, a.recipient_phone, a.message_body, a.payload_type,
              a.template_name, a.template_language, a.template_parameters, t.components AS template_components,
              a.status, a.requested_by, a.correlation_id, a.expires_at, a.created_at
       FROM whatsapp_send_actions a
       LEFT JOIN whatsapp_templates t ON t.organization_id=a.organization_id
         AND t.whatsapp_account_id=a.whatsapp_account_id AND t.name=a.template_name AND t.language=a.template_language
       WHERE a.organization_id=$1 AND a.status IN ('pending','requires_template')
       ORDER BY a.created_at DESC LIMIT 100`,
      [organizationId],
    );
    return NextResponse.json({ actions: actions.rows.map((action) => {
      const parameters = Array.isArray(action.template_parameters) ? action.template_parameters : [];
      const components = Array.isArray(action.template_components) ? action.template_components : [];
      const bodyComponent = components.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "BODY") as Record<string, unknown> | undefined;
      let templatePreview = typeof bodyComponent?.text === "string" ? bodyComponent.text : "";
      parameters.forEach((value, index) => {
        templatePreview = templatePreview.replaceAll("{{" + (index + 1) + "}}", () => typeof value === "string" ? value : "");
      });
      return {
        ...action,
        recipient_phone: action.recipient_phone,
        message_body: action.message_body.slice(0, 4096),
        template_preview: action.payload_type === "template" ? templatePreview : null,
      };
    }) });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
