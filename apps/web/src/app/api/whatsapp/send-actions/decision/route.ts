import { NextResponse } from "next/server";
import { getWhatsAppAccountForOrganization, loadWhatsAppCredential, parseCredentialsMasterKey, queueWhatsAppOutboundMessage, query, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

type SendAction = {
  id: string;
  organization_id: string;
  whatsapp_account_id: string;
  agent_id: string | null;
  agent_binding_required: boolean;
  recipient_phone: string;
  message_body: string;
  status: string;
  idempotency_key: string | null;
  correlation_id: string;
  expires_at: string;
  approved_by: string | null;
  queued_message_id: string | null;
  payload_type: string;
  template_name: string | null;
  template_language: string | null;
  template_parameters: unknown;
};

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const actionId = typeof body?.actionId === "string" ? body.actionId : "";
    const decision = body?.decision;
    if (!organizationId || !actionId || (decision !== "approve" && decision !== "reject")) {
      return NextResponse.json({ error: "validation_error", message: "organizationId, actionId and decision (approve|reject) are required." }, { status: 422 });
    }
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "whatsapp.send" }, getIdentityAdapter(), getIdentityRepository());
    const found = await query<SendAction>(
      "SELECT id, organization_id, whatsapp_account_id, agent_id, agent_binding_required, recipient_phone, message_body, status, idempotency_key, correlation_id, expires_at, approved_by, queued_message_id, payload_type, template_name, template_language, template_parameters FROM whatsapp_send_actions WHERE id=$1 AND organization_id=$2 LIMIT 1",
      [actionId, organizationId],
    );
    const action = found.rows[0];
    if (!action) return NextResponse.json({ error: "not_found", message: "WhatsApp send approval was not found in this organization." }, { status: 404 });
    if (action.status === "queued") return NextResponse.json({ approved: true, queued: true, status: "queued", messageId: action.queued_message_id ?? null, message: "Already queued; provider delivery is not yet confirmed." });
    if (action.status === "sent") return NextResponse.json({ approved: true, queued: true, status: "sent", messageId: action.queued_message_id ?? null, message: "Meta accepted this message; recipient delivery is not yet confirmed." });
    if (action.status === "rejected" || action.status === "requires_template" || action.status === "expired" || action.status === "failed") {
      return NextResponse.json({ error: "invalid_action_state", status: action.status, message: "This approval can no longer be decided." }, { status: 409 });
    }
    if (Date.parse(action.expires_at) <= Date.now()) {
      await query("UPDATE whatsapp_send_actions SET status='expired', updated_at=now() WHERE id=$1 AND organization_id=$2 AND status IN ('pending','approved')", [actionId, organizationId]);
      await recordAuditEvent({ organizationId, actorUserId: actor.user.id, correlationId: action.correlation_id, eventType: "whatsapp.send_approval.expired", targetType: "whatsapp_send_action", targetId: actionId, action: "decide", decision: "expired" });
      return NextResponse.json({ error: "approval_expired", status: "expired" }, { status: 409 });
    }

    if (decision === "reject") {
      const rejected = await query<{ id: string }>(
        "UPDATE whatsapp_send_actions SET status='rejected', approved_by=$3, approved_at=now(), updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='pending' RETURNING id",
        [actionId, organizationId, actor.user.id],
      );
      if (!rejected.rows.length) return NextResponse.json({ error: "decision_conflict", message: "The action was already decided." }, { status: 409 });
      await recordAuditEvent({ organizationId, actorUserId: actor.user.id, correlationId: action.correlation_id, eventType: "whatsapp.send_approval.rejected", targetType: "whatsapp_send_action", targetId: actionId, action: "reject", decision: "denied" });
      return NextResponse.json({ approved: false, status: "rejected" });
    }

    const account = await getWhatsAppAccountForOrganization(organizationId, action.whatsapp_account_id);
    if (!account || account.status !== "connected") {
      return NextResponse.json({ error: "provider_not_connected", message: "The WhatsApp account must remain connected at approval time." }, { status: 409 });
    }
    if (action.agent_binding_required) {
      if (!action.agent_id) {
        await query("UPDATE whatsapp_send_actions SET status='failed', updated_at=now() WHERE id=$1 AND organization_id=$2 AND status IN ('pending','approved')", [actionId, organizationId]);
        return NextResponse.json({ error: "agent_binding_missing", message: "This request was created by an agent whose binding is no longer available; it cannot be approved." }, { status: 409 });
      }
      const binding = await query<{ agent_id: string }>(
        "SELECT b.agent_id FROM agent_whatsapp_accounts b JOIN agents a ON a.id=b.agent_id AND a.organization_id=$1 WHERE b.agent_id=$2 AND b.whatsapp_account_id=$3 LIMIT 1",
        [organizationId, action.agent_id, action.whatsapp_account_id],
      );
      if (!binding.rows.length) {
        await query("UPDATE whatsapp_send_actions SET status='failed', updated_at=now() WHERE id=$1 AND organization_id=$2 AND status IN ('pending','approved')", [actionId, organizationId]);
        await recordAuditEvent({ organizationId, actorUserId: actor.user.id, correlationId: action.correlation_id, eventType: "whatsapp.send_approval.binding_revoked", targetType: "whatsapp_send_action", targetId: actionId, action: "approve", decision: "denied", metadata: { agentId: action.agent_id } });
        return NextResponse.json({ error: "agent_binding_missing", message: "The agent-to-WhatsApp account binding has changed; this request cannot be approved." }, { status: 409 });
      }
    }

    const templateParameters = Array.isArray(action.template_parameters) ? action.template_parameters : [];
    if (action.payload_type === "template") {
      if (!action.template_name || !action.template_language) {
        return NextResponse.json({ error: "invalid_template_action", message: "Template name and language are required." }, { status: 409 });
      }
      // Re-query Meta at approval time; cached status alone must not authorize a template send.
      const masterKeyValue = process.env.CREDENTIALS_MASTER_KEY?.trim();
      if (!masterKeyValue || !account.business_account_id) {
        return NextResponse.json({ error: "template_status_unavailable", message: "Current Meta template approval could not be verified." }, { status: 503 });
      }
      const credential = await loadWhatsAppCredential(account.id, organizationId, parseCredentialsMasterKey(masterKeyValue));
      const token = typeof credential?.access_token === "string" ? credential.access_token : "";
      if (!token) return NextResponse.json({ error: "template_status_unavailable", message: "Current Meta template approval could not be verified." }, { status: 503 });
      const version = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
      const templateUrl = new URL(version + "/" + encodeURIComponent(account.business_account_id) + "/message_templates", "https://graph.facebook.com/");
      templateUrl.searchParams.set("name", action.template_name);
      templateUrl.searchParams.set("fields", "id,name,language,status,components");
      const metaResponse = await fetch(templateUrl, { headers: { authorization: "Bearer " + token } });
      const metaPayload = await metaResponse.json().catch(() => ({})) as { error?: { message?: unknown }; data?: Array<{ id?: unknown; name?: unknown; language?: unknown; status?: unknown; components?: unknown }> };
      if (!metaResponse.ok) return NextResponse.json({ error: "template_status_unavailable", message: "Current Meta template approval could not be verified." }, { status: 503 });
      const currentTemplate = (Array.isArray(metaPayload.data) ? metaPayload.data : []).find((item) => item.name === action.template_name && item.language === action.template_language);
      const approvedNow = currentTemplate?.status === "APPROVED" && typeof currentTemplate.id === "string";
      if (!approvedNow) {
        await query("UPDATE whatsapp_templates SET status=$5, last_synced_at=now(), updated_at=now() WHERE organization_id=$1 AND whatsapp_account_id=$2 AND name=$3 AND language=$4", [organizationId, action.whatsapp_account_id, action.template_name, action.template_language, currentTemplate?.status === "REJECTED" ? "rejected" : "pending"]);
        return NextResponse.json({ error: "template_not_approved", message: "Meta does not currently report this template as approved." }, { status: 409 });
      }
      const synced = await query<{ components: unknown }>(
        "UPDATE whatsapp_templates SET provider_template_id=$5, status='approved', components=$6::jsonb, last_synced_at=now(), updated_at=now() WHERE organization_id=$1 AND whatsapp_account_id=$2 AND name=$3 AND language=$4 RETURNING components",
        [organizationId, action.whatsapp_account_id, action.template_name, action.template_language, currentTemplate.id, JSON.stringify(Array.isArray(currentTemplate.components) ? currentTemplate.components : [])],
      );
      if (!synced.rows.length) return NextResponse.json({ error: "template_not_synced", message: "Approved template is not stored for this WhatsApp account." }, { status: 409 });
      const components = synced.rows[0].components;
      const componentList = Array.isArray(components) ? components.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
      const unsupportedComponents = componentList.some((item) => {
        if (item.type === "BUTTONS") return true;
        if (item.type !== "HEADER") return false;
        const format = typeof item.format === "string" ? item.format : "TEXT";
        const headerText = typeof item.text === "string" ? item.text : "";
        return format !== "TEXT" || /\{\{\d+\}\}/.test(headerText);
      });
      if (unsupportedComponents) {
        return NextResponse.json({ error: "unsupported_template_components", message: "This sender supports approved text templates with body parameters only; media, dynamic headers and button templates fail closed." }, { status: 409 });
      }
      const bodyComponent = componentList.find((item) => item.type === "BODY");
      const bodyText = typeof bodyComponent?.text === "string" ? bodyComponent.text : "";
      const indexes = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
      const requiredParameters = indexes.length ? Math.max(...indexes) : 0;
      if (templateParameters.length !== requiredParameters || templateParameters.some((value) => typeof value !== "string" || value.length > 1024)) {
        return NextResponse.json({ error: "template_parameter_mismatch", message: "Template parameters no longer match the approved template." }, { status: 409 });
      }
    } else if (action.payload_type === "text") {
      // Meta's customer-service window is based on a recent inbound customer
      // message, not the timestamp of the last outbound message or contact record.
      const inbound = await query<{ id: string }>(
        `SELECT m.id FROM whatsapp_messages m
         JOIN whatsapp_contacts c ON c.id=m.contact_id
         WHERE m.organization_id=$1 AND m.whatsapp_account_id=$2
           AND c.phone_number=$3 AND m.direction='inbound'
           AND COALESCE(m.provider_timestamp,m.created_at) >= now() - interval '24 hours'
           AND COALESCE(m.provider_timestamp,m.created_at) <= now()
         ORDER BY COALESCE(m.provider_timestamp,m.created_at) DESC LIMIT 1`,
        [organizationId, action.whatsapp_account_id, action.recipient_phone],
      );
      if (!inbound.rows.length) {
        await query("UPDATE whatsapp_send_actions SET status='requires_template', updated_at=now() WHERE id=$1 AND organization_id=$2 AND status IN ('pending','approved')", [actionId, organizationId]);
        await recordAuditEvent({ organizationId, actorUserId: actor.user.id, correlationId: action.correlation_id, eventType: "whatsapp.send_approval.template_required", targetType: "whatsapp_send_action", targetId: actionId, action: "approve", decision: "denied", metadata: { reason: "outside_customer_service_window" } });
        return NextResponse.json({ error: "template_required", status: "requires_template", message: "No inbound customer message was received in the last 24 hours. Meta requires an approved message template outside that window; no free-form text was queued." }, { status: 409 });
      }
    } else {
      return NextResponse.json({ error: "unsupported_payload_type", message: "The requested WhatsApp payload type is not supported." }, { status: 409 });
    }

    if (action.status === "pending") {
      const approved = await query<{ id: string }>(
        "UPDATE whatsapp_send_actions SET status='approved', approved_by=$3, approved_at=now(), updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='pending' RETURNING id",
        [actionId, organizationId, actor.user.id],
      );
      if (!approved.rows.length) return NextResponse.json({ error: "decision_conflict", message: "The action was already decided." }, { status: 409 });
    }

    const idempotencyKey = action.idempotency_key || "whatsapp-approval:" + action.id;
    const messageId = await queueWhatsAppOutboundMessage({
      organizationId, accountId: action.whatsapp_account_id, to: action.recipient_phone,
      body: action.message_body,
      messageType: action.payload_type === "template" ? "template" : "text",
      media: action.payload_type === "template" ? { template: { name: action.template_name, language: action.template_language, parameters: templateParameters } } : {},
      idempotencyKey, correlationId: action.correlation_id,
    });
    if (!messageId) {
      const existing = await query<{ id: string }>(
        "SELECT id FROM whatsapp_messages WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1",
        [organizationId, idempotencyKey],
      );
      if (!existing.rows[0]) throw new Error("Approved WhatsApp message queue state could not be reconciled");
    }
    const resolvedMessageId = messageId || (await query<{ id: string }>("SELECT id FROM whatsapp_messages WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1", [organizationId, idempotencyKey])).rows[0]?.id;
    const outcome = await query<{ status: string }>(
      "UPDATE whatsapp_send_actions SET status=CASE WHEN status='approved' THEN 'queued' ELSE status END, queued_message_id=COALESCE(queued_message_id,$3), updated_at=now() WHERE id=$1 AND organization_id=$2 AND status IN ('approved','queued','sent','failed','requires_template') RETURNING status",
      [actionId, organizationId, resolvedMessageId ?? null],
    );
    const outcomeStatus = outcome.rows[0]?.status ?? "queued";
    await recordAuditEvent({ organizationId, actorUserId: actor.user.id, correlationId: action.correlation_id, eventType: "whatsapp.send_approval.approved", targetType: "whatsapp_send_action", targetId: actionId, action: "approve", decision: "allowed", metadata: { messageId: resolvedMessageId ?? null, payloadType: action.payload_type, outcomeStatus } });
    const message = outcomeStatus === "failed"
      ? "Approval was recorded, but the worker reports that sending failed. Check the message status before retrying."
      : outcomeStatus === "sent"
        ? "Approved and accepted by Meta. Recipient delivery is not yet confirmed."
        : outcomeStatus === "requires_template"
          ? "The worker blocked this free-form message because the 24-hour window closed; use an approved template."
          : "Approved and queued for delivery. Provider delivery is not yet confirmed.";
    return NextResponse.json({ approved: true, queued: outcomeStatus === "queued" || outcomeStatus === "sent" || outcomeStatus === "requires_template" || outcomeStatus === "failed", status: outcomeStatus, messageId: resolvedMessageId ?? null, message }, { status: 202 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
