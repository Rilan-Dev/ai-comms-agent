import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "@ai-comms-agent/shared";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("@ai-comms-agent/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ai-comms-agent/db")>();
  return { ...actual, query: mocks.query, recordAuditEvent: mocks.recordAuditEvent };
});

import { createWhatsAppSendApprovalTool } from "../src/agent/whatsapp-tool-runtime";

const context: ToolContext = {
  organization_id: "org-1",
  agent_id: "agent-1",
  user_id: "user-1",
  conversation_id: "conversation-1",
  turn_id: "turn-1",
  correlation_id: "correlation-1",
  channel: "chat",
  auth_subject: { user_id: "user-1", role: "owner", permissions: ["whatsapp.send"] },
};

describe("WhatsApp send approval tool behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it("creates a pending approval and never queues provider delivery", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "account-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "action-1", status: "pending" }] });

    const tool = createWhatsAppSendApprovalTool();
    const result = await tool.execute({
      account_id: "account-1",
      to: "+919876543210",
      payload_type: "text",
      body: "Hello from Clara",
    }, context);

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ approval_required: true, action_id: "action-1", status: "pending" });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls[0][0]).toContain("agent_whatsapp_accounts");
    expect(mocks.query.mock.calls[1][0]).toContain("INSERT INTO whatsapp_send_actions");
    expect(mocks.query.mock.calls[1][0]).toContain("agent_binding_required");
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "whatsapp.send_approval.requested",
      targetType: "whatsapp_send_action",
      decision: "pending",
    }));
  });

  it("rejects invalid recipients before creating any action", async () => {
    const tool = createWhatsAppSendApprovalTool();
    const result = await tool.execute({
      account_id: "account-1",
      to: "not-a-phone",
      payload_type: "text",
      body: "Hello",
    }, context);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("invalid_recipient");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("fails closed when the connected account is not bound to the active agent", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });
    const tool = createWhatsAppSendApprovalTool();
    const result = await tool.execute({
      account_id: "other-account",
      to: "+919876543210",
      payload_type: "text",
      body: "Hello",
    }, context);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("account_not_bound");
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });
});
