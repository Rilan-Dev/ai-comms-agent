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

  it("requires an authenticated organization update permission to decide", () => {
    expect(decisionRoute).toContain('permission: "whatsapp.send"');
    expect(messagesRoute).toContain('permission: "whatsapp.send"');
    expect(decisionRoute).toContain('decision !== "approve" && decision !== "reject"');
    expect(decisionRoute).toContain("WHERE id=$1 AND organization_id=$2");
    expect(decisionRoute).toContain("whatsapp.send_approval.approved");
    expect(decisionRoute).toContain("whatsapp.send_approval.rejected");
  });

  it("rechecks the 24-hour customer-service window from an inbound message", () => {
    expect(decisionRoute).toContain("m.direction='inbound'");
    expect(decisionRoute).toContain("now() - interval '24 hours'");
    expect(decisionRoute).toContain("status='requires_template'");
    expect(decisionRoute).toContain("template_required");
    expect(decisionRoute).toContain("no free-form text was queued");
    expect(whatsappWorker).toContain("no inbound customer message within Meta");
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

  it("registers whatsapp.send only as an approval-request tool", () => {
    expect(whatsappRuntime).toContain("registry.register(createWhatsAppHistoryTool())");
    expect(whatsappRuntime).toContain("registry.register(createWhatsAppSendApprovalTool())");
    expect(whatsappRuntime).toContain('name: "whatsapp.send"');
    expect(whatsappRuntime).toContain("INSERT INTO whatsapp_send_actions");
    expect(whatsappRuntime).toContain("approval_required: true");
    expect(whatsappRuntime).not.toContain("queueWhatsAppOutboundMessage");
    expect(whatsappRuntime).toContain("whatsapp.send_approval.requested");
  });
});
