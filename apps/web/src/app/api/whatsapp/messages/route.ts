import { NextResponse } from "next/server";
import { getWhatsAppAccountForOrganization, listWhatsAppMessagesForOrganization, query, recordAuditEvent } from "@ai-comms-agent/db";
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
    const payloadType = body?.payloadType === "template" ? "template" : "text";
    const templateName = typeof body?.templateName === "string" ? body.templateName.trim() : "";
    const templateLanguage = typeof body?.templateLanguage === "string" ? body.templateLanguage.trim() : "";
    const templateParameters = Array.isArray(body?.templateParameters) ? body.templateParameters : [];
    const messageBody = payloadType === "text"
      ? (typeof body?.body === "string" ? body.body.trim() : "")
      : "Template: " + templateName;
    const parametersValid = templateParameters.length <= 20
      && templateParameters.every((value: unknown) => typeof value === "string" && value.length <= 1024);
    if (!organizationId || !accountId || !/^\+[1-9]\d{7,14}$/.test(to)
      || !messageBody || messageBody.length > 4096
      || (payloadType === "template" && (!/^[a-z0-9_]{1,512}$/.test(templateName) || !/^[a-zA-Z0-9_-]{2,32}$/.test(templateLanguage) || !parametersValid))
      || (payloadType === "text" && (typeof body?.body !== "string" || !body.body.trim() || body.body.trim().length > 4096))) {
      return NextResponse.json({ error: "validation_error", message: "Organization, account, E.164 recipient and valid text or template parameters are required." }, { status: 422 });
    }
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const account = await getWhatsAppAccountForOrganization(organizationId, accountId);
    if (!account) return NextResponse.json({ error: "not_found", message: "WhatsApp account was not found." }, { status: 404 });
    if (account.status !== "connected") return NextResponse.json({ error: "provider_not_connected", message: "WhatsApp account must be verified and connected before outbound messages can be queued." }, { status: 409 });
    if (payloadType === "template") {
      const approvedTemplate = await query<{ components: unknown }>(
        "SELECT components FROM whatsapp_templates WHERE organization_id=$1 AND whatsapp_account_id=$2 AND name=$3 AND language=$4 AND status='approved' LIMIT 1",
        [organizationId, accountId, templateName, templateLanguage],
      );
      const components = approvedTemplate.rows[0]?.components;
      if (!approvedTemplate.rows.length) return NextResponse.json({ error: "template_not_approved", message: "Only a template synchronized from Meta with approved status can be proposed for sending." }, { status: 409 });
      const bodyComponent = Array.isArray(components) ? components.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "BODY") as Record<string, unknown> | undefined : undefined;
      const bodyText = typeof bodyComponent?.text === "string" ? bodyComponent.text : "";
      const indexes = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
      const requiredParameters = indexes.length ? Math.max(...indexes) : 0;
      if (templateParameters.length !== requiredParameters) {
        return NextResponse.json({ error: "template_parameter_mismatch", message: "Template parameter count does not match the approved template body." }, { status: 422 });
      }
    }
    const requestedIdempotencyKey = request.headers.get("Idempotency-Key") ?? (typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "");
    const idempotencyKey = requestedIdempotencyKey.trim() || crypto.randomUUID();
    if (idempotencyKey.length > 200) return NextResponse.json({ error: "validation_error", message: "Idempotency-Key must be 200 characters or fewer." }, { status: 422 });
    const correlationId = crypto.randomUUID();

    // Outbound requests are proposals only. The worker queue is reached solely
    // after a separate authenticated human approval and a fresh Meta window check.
    const inserted = await query<{ id: string }>(
      `INSERT INTO whatsapp_send_actions
        (organization_id, whatsapp_account_id, requested_by, recipient_phone, message_body, payload_type, template_name, template_language, template_parameters, status, idempotency_key, correlation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'pending',$10,$11)
       ON CONFLICT (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL
       DO NOTHING RETURNING id`,
      [organizationId, accountId, actor.user.id, to, messageBody, payloadType, payloadType === "template" ? templateName : null, payloadType === "template" ? templateLanguage : null, JSON.stringify(payloadType === "template" ? templateParameters : []), idempotencyKey, correlationId],
    );
    let actionId = inserted.rows[0]?.id ? String(inserted.rows[0].id) : "";
    if (!actionId) {
      const existing = await query<{ id: string; whatsapp_account_id: string; recipient_phone: string; message_body: string; status: string; payload_type: string; template_name: string | null; template_language: string | null; template_parameters: unknown }>(
        "SELECT id, whatsapp_account_id, recipient_phone, message_body, status, payload_type, template_name, template_language, template_parameters FROM whatsapp_send_actions WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1",
        [organizationId, idempotencyKey],
      );
      const row = existing.rows[0];
      if (!row) throw new Error("WhatsApp approval idempotency conflict could not be resolved");
      if (String(row.whatsapp_account_id) !== accountId || String(row.recipient_phone) !== to || String(row.message_body) !== messageBody || row.payload_type !== payloadType || (row.template_name ?? null) !== (payloadType === "template" ? templateName : null) || (row.template_language ?? null) !== (payloadType === "template" ? templateLanguage : null) || JSON.stringify(row.template_parameters ?? []) !== JSON.stringify(payloadType === "template" ? templateParameters : [])) {
        return NextResponse.json({ error: "idempotency_conflict", message: "This Idempotency-Key was already used for a different WhatsApp message." }, { status: 409 });
      }
      actionId = String(row.id);
      return NextResponse.json({ approvalRequired: true, actionId, status: row.status, message: "This WhatsApp message is awaiting or has already received an approval decision." }, { status: 202 });
    }
    await recordAuditEvent({ organizationId, actorUserId: actor.user.id, correlationId, eventType: "whatsapp.send_approval.requested", targetType: "whatsapp_send_action", targetId: actionId, action: "request_send", decision: "pending", metadata: { accountId, recipientSuffix: to.slice(-4), payloadType } });
    return NextResponse.json({ approvalRequired: true, actionId, status: "pending", correlationId, message: "Message saved for human approval. It has not been sent." }, { status: 202 });
  } catch (error) { return authorizationErrorToResponse(error); }
}
