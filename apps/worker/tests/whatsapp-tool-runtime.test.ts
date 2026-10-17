import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runtime = readFileSync(resolve(__dirname, "../src/agent/whatsapp-tool-runtime.ts"), "utf8");

describe("WhatsApp history tool runtime", () => {
  it("registers history as a read-only messaging tool and requires whatsapp.read", () => {
    expect(runtime).toContain('name: "whatsapp.history"');
    expect(runtime).toContain('domain: "messaging"');
    expect(runtime).toContain('sensitivity: "safe"');
    expect(runtime).toContain('required_permission: "whatsapp.read"');
  });
  it("restricts history to connected accounts bound to the active agent and organization", () => {
    expect(runtime).toContain("w.organization_id = $1");
    expect(runtime).toContain("w.status = 'connected'");
    expect(runtime).toContain("w.deleted_at IS NULL");
    expect(runtime).toContain("JOIN agent_whatsapp_accounts b");
    expect(runtime).toContain("b.agent_id = $2");
    expect(runtime).toContain("a.organization_id = $1");
    expect(runtime).toContain("m.organization_id = $1");
  });
  it("rechecks the current agent tool allowlist and audits every invocation", () => {
    expect(runtime).toContain("const currentPolicy = await agents.policy(organizationId, agentId)");
    expect(runtime).toContain("currentPolicy?.allowedTools.includes(tool.name)");
    expect(runtime).toContain("recordAuditEvent");
    expect(runtime).toContain("executeRegisteredTool");
  });
  it("exposes outbound sending only as a pending-approval proposal", () => {
    expect(runtime).toContain('name: "whatsapp.send"');
    expect(runtime).toContain("registry.register(createWhatsAppSendApprovalTool())");
    expect(runtime).toContain("INSERT INTO whatsapp_send_actions");
    expect(runtime).toContain("approval_required: true");
    expect(runtime).not.toContain("queueWhatsAppOutboundMessage");
    expect(runtime).toContain("whatsapp.send_approval.requested");
  });
});