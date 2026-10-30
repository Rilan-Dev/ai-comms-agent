import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const messagesRoute = readFileSync(resolve(__dirname, "../src/app/api/whatsapp/messages/route.ts"), "utf8");
const decisionRoute = readFileSync(resolve(__dirname, "../src/app/api/whatsapp/send-actions/decision/route.ts"), "utf8");
const migration = readFileSync(resolve(__dirname, "../../../supabase/migrations/0035_whatsapp_send_approvals.sql"), "utf8");
const whatsappRuntime = readFileSync(resolve(__dirname, "../../worker/src/agent/whatsapp-tool-runtime.ts"), "utf8");
const templatesRoute = readFileSync(resolve(__dirname, "../src/app/api/whatsapp/templates/route.ts"), "utf8");
const whatsappWorker = readFileSync(resolve(__dirname, "../../worker/src/messaging/whatsapp-worker.ts"), "utf8");
const templateMigration = readFileSync(resolve(__dirname, "../../../supabase/migrations/0036_whatsapp_templates.sql"), "utf8");
const permissionsMigration = readFileSync(resolve(__dirname, "../../../supabase/migrations/0038_whatsapp_feature_permissions.sql"), "utf8");
const whatsappClient = readFileSync(resolve(__dirname, "../src/app/whatsapp/whatsapp-client.tsx"), "utf8");
const productActionExecutor = readFileSync(resolve(__dirname, "../../worker/src/agent/product-action-executor.ts"), "utf8");

describe("WhatsApp send approval safety boundary", () => {
  it("persists outbound requests as pending approvals instead of queueing them", () => {
    expect(messagesRoute).toContain("INSERT INTO whatsapp_send_actions");
    expect(messagesRoute).toContain("'pending'");
    expect(messagesRoute).toContain("whatsapp.send_approval.requested");
    expect(messagesRoute).not.toContain("queueWhatsAppOutboundMessage");
    expect(messagesRoute).toContain("Message saved for human approval. It has not been sent.");
  });

  it("requires an authenticated WhatsApp send permission to decide", () => {
    expect(decisionRoute).toContain('permission: "whatsapp.send"');
    expect(messagesRoute).toContain('permission: "whatsapp.send"');
    expect(decisionRoute).toContain('decision !== "approve" && decision !== "reject"');
    expect(decisionRoute).toContain("WHERE id=$1 AND organization_id=$2");
    expect(decisionRoute).toContain("whatsapp.send_approval.approved");
    expect(decisionRoute).toContain("whatsapp.send_approval.rejected");
    expect(decisionRoute).toContain("agent_binding_required");
    expect(whatsappWorker).toContain("agent_binding_required");
    expect(whatsappWorker).toContain("account.status !== \"connected\"");
  });

  it("rechecks the 24-hour customer-service window from an inbound message", () => {
    expect(decisionRoute).toContain("m.direction='inbound'");
    expect(decisionRoute).toContain("now() - interval '24 hours'");
    expect(decisionRoute).toContain("status='requires_template'");
    expect(decisionRoute).toContain("template_required");
    expect(decisionRoute).toContain("no free-form text was queued");
    expect(whatsappWorker).toContain("no inbound customer message within Meta");
    expect(whatsappWorker).toContain("No active human-approved WhatsApp action is associated");
  });

  it("persists expiry, idempotency, organization scoping, and audit correlation", () => {
    expect(migration).toContain("whatsapp_send_actions");
    expect(migration).toContain("expires_at");
    expect(migration).toContain("whatsapp_send_actions_idempotency_uniq");
    expect(migration).toContain("can_access_organization(organization_id)");
    expect(decisionRoute).toContain("action.correlation_id");
  });

  it("requires templates to be submitted to and status-synced from Meta", () => {
    expect(templatesRoute).toContain("/message_templates");
    expect(templatesRoute).toContain("templateStatus(payload.status)");
    expect(templatesRoute).toContain('permission: "whatsapp.send"');
    expect(templateMigration).toContain("whatsapp_templates");
    expect(templateMigration).toContain("status text NOT NULL DEFAULT 'pending'");
    expect(permissionsMigration).toContain("'whatsapp.read'");
    expect(permissionsMigration).toContain("'whatsapp.send'");
  });

  it("gives WhatsApp failures a WhatsApp-specific in-chat recovery message", () => {
    const streamRoute = readFileSync(resolve(__dirname, "../src/app/api/chat/stream/route.ts"), "utf8");
    expect(streamRoute).toContain("I couldn’t confirm the request’s outcome.");
    expect(streamRoute).toContain("saveWhatsAppCard(failureMessage)");
    expect(streamRoute).toContain("widget:recovery.widget");
    expect(streamRoute).not.toContain("retrying an email action. Reference: ${reference}");
  });

  it("supports only approved text-body template payloads and rejects unsupported components", () => {
    expect(decisionRoute).toContain("Meta does not currently report this template as approved");
    expect(decisionRoute).toContain("unsupported_template_components");
    expect(whatsappWorker).toContain('message.message_type !== "template"');
    expect(whatsappWorker).toContain('type: "template"');
    expect(whatsappWorker).toContain("Approved WhatsApp template payload is invalid");
    expect(whatsappWorker).toContain('item.status === "APPROVED"');
  });

  it("prevents scheduled/product actions from bypassing the approval workflow", () => {
    expect(productActionExecutor).toContain("INSERT INTO whatsapp_send_actions");
    expect(productActionExecutor).toContain("agent_binding_required");
    expect(productActionExecutor).toContain('status: "pending_approval"');
    expect(productActionExecutor).not.toContain("queueWhatsAppOutboundMessage");
  });

  it("exposes approval decisions and approved-template submission in the WhatsApp workspace", () => {
    expect(whatsappClient).toContain("/api/whatsapp/send-actions");
    expect(whatsappClient).toContain('decideApproval(action.id,"approve")');
    expect(whatsappClient).toContain('decideApproval(action.id,"reject")');
    expect(whatsappClient).toContain("/api/whatsapp/templates");
    expect(whatsappClient).toContain("Request approval");
    expect(whatsappClient).toContain("This message has not been sent");
  });

  it("registers whatsapp.send as a policy-gated send tool", () => {
    expect(whatsappRuntime).toContain("registry.register(createWhatsAppHistoryTool() as unknown as Tool)");
    expect(whatsappRuntime).toContain("registry.register(createWhatsAppSendApprovalTool() as unknown as Tool)");
    expect(whatsappRuntime).toContain('name: "whatsapp.send"');
    expect(whatsappRuntime).toContain("INSERT INTO whatsapp_send_actions");
    expect(whatsappRuntime).toContain("approval_required: true");
    expect(whatsappRuntime).toContain("whatsapp.send_approval.requested");
    // Provider queueing exists ONLY behind the saved autonomous-send policy
    // check; without that flag the tool still creates a pending approval only.
    expect(whatsappRuntime).toContain("isAutonomousSendEnabled(policy?.securityPolicy)");
    expect(whatsappRuntime).toContain("queueWhatsAppOutboundMessage");
  });
  it("defaults destructured template selection values under strict indexed access", () => {
    expect(whatsappClient).toContain('const [name = "",language = "en_US"]=e.target.value.split("|");');
  });

  it("fails closed when the approved template update returns no row", () => {
    expect(decisionRoute).toContain("const syncedTemplate = synced.rows[0];");
    expect(decisionRoute).toContain('if (!syncedTemplate) return NextResponse.json({ error: "template_not_synced"');
    expect(decisionRoute).toContain("const components = syncedTemplate.components;");
    expect(decisionRoute).not.toContain("synced.rows[0].components");
  });

});
