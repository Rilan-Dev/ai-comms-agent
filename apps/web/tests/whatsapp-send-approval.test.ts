import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const messagesRoute = readFileSync(resolve(__dirname, "../src/app/api/whatsapp/messages/route.ts"), "utf8");
const decisionRoute = readFileSync(resolve(__dirname, "../src/app/api/whatsapp/send-actions/decision/route.ts"), "utf8");
const migration = readFileSync(resolve(__dirname, "../../../supabase/migrations/0035_whatsapp_send_approvals.sql"), "utf8");
const whatsappRuntime = readFileSync(resolve(__dirname, "../../worker/src/agent/whatsapp-tool-runtime.ts"), "utf8");

describe("WhatsApp send approval safety boundary", () => {
  it("persists outbound requests as pending approvals instead of queueing them", () => {
    expect(messagesRoute).toContain("INSERT INTO whatsapp_send_actions");
    expect(messagesRoute).toContain("'pending'");
    expect(messagesRoute).toContain("whatsapp.send_approval.requested");
    expect(messagesRoute).not.toContain("queueWhatsAppOutboundMessage");
    expect(messagesRoute).toContain("Message saved for human approval. It has not been sent.");
  });

  it("requires an authenticated organization update permission to decide", () => {
    expect(decisionRoute).toContain('permission: "organization.update"');
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
    expect(decisionRoute).toContain("did not queue a message");
  });

  it("persists expiry, idempotency, organization scoping, and audit correlation", () => {
    expect(migration).toContain("whatsapp_send_actions");
    expect(migration).toContain("expires_at");
    expect(migration).toContain("whatsapp_send_actions_idempotency_uniq");
    expect(migration).toContain("can_access_organization(organization_id)");
    expect(decisionRoute).toContain("action.correlation_id");
  });

  it("keeps whatsapp.send unregistered until the secure template-aware path exists", () => {
    expect(whatsappRuntime).toContain("registry.register(createWhatsAppHistoryTool())");
    expect(whatsappRuntime).not.toContain('name: "whatsapp.send"');
    expect(whatsappRuntime).toContain("approval and template compliance exist");
  });
});
