import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "@ai-comms-agent/shared";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  recordAuditEvent: vi.fn(),
  policy: vi.fn(),
  queueWhatsAppOutboundMessage: vi.fn(),
}));

vi.mock("@ai-comms-agent/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ai-comms-agent/db")>();
  return {
    ...actual,
    query: mocks.query,
    recordAuditEvent: mocks.recordAuditEvent,
    queueWhatsAppOutboundMessage: mocks.queueWhatsAppOutboundMessage,
    PostgresAgentRepository: class {
      policy = mocks.policy;
    },
  };
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
    // Default: no saved autonomous-send policy → pending human approval.
    mocks.policy.mockResolvedValue({ securityPolicy: {}, allowedTools: ["whatsapp.send"] });
    mocks.queueWhatsAppOutboundMessage.mockReset();
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

  it("reuses a still-pending identical approval without creating another action", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "account-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "existing-pending", status: "pending" }] });
    const result = await createWhatsAppSendApprovalTool().execute({
      account_id: "account-1", to: "+919876543210",
      payload_type: "text", body: "Same reviewed text",
    }, context);
    expect(result.ok).toBe(true);
    expect(result.output).toEqual({
      approval_required: true, action_id: "existing-pending", status: "pending",
    });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls[1][0]).toContain("DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key");
    expect(mocks.query.mock.calls[1][0]).toContain("whatsapp_send_actions.requested_by IS NOT DISTINCT FROM EXCLUDED.requested_by");
    expect(mocks.query.mock.calls[1][0]).toContain("whatsapp_send_actions.status = 'pending'");
  });

  it("rejects reused or finalized idempotency keys without an audit claiming fresh approval", async () => {
    // PostgreSQL's atomic ON CONFLICT predicate returns zero rows for a
    // different actor, agent, payload, or non-pending/expired existing action.
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "account-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await createWhatsAppSendApprovalTool().execute({
      account_id: "account-1", to: "+919876543210",
      payload_type: "text", body: "Safe test",
    }, context);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("idempotency_conflict");
    expect(result.error?.message).toContain("No new approval was created");
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
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

describe("WhatsApp send tool under the autonomous-send policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.policy.mockResolvedValue({ securityPolicy: { autonomous_send: true }, allowedTools: ["whatsapp.send"] });
    mocks.queueWhatsAppOutboundMessage.mockResolvedValue("message-1");
  });

  it("approves and queues the send automatically when the policy is enabled", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "account-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "action-1", status: "pending" }] })
      // 24h customer-service window check finds a recent inbound message.
      .mockResolvedValueOnce({ rows: [{ id: "inbound-1" }] })
      // pending -> approved transition.
      .mockResolvedValueOnce({ rows: [{ id: "action-1" }] })
      // approved -> queued transition.
      .mockResolvedValueOnce({ rows: [{ status: "queued" }] });

    const result = await createWhatsAppSendApprovalTool().execute({
      account_id: "account-1", to: "+919876543210",
      payload_type: "text", body: "Autonomous hello",
    }, context);

    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({
      approval_required: false, auto_approved: true,
      action_id: "action-1", status: "queued", message_id: "message-1",
    });
    // Meta's 24-hour window rule still gates free-form text.
    expect(mocks.query.mock.calls[2][0]).toContain("interval '24 hours'");
    expect(mocks.queueWhatsAppOutboundMessage).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1", accountId: "account-1", to: "+919876543210",
      body: "Autonomous hello", messageType: "text",
    }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "whatsapp.send_approval.auto_approved",
      decision: "allowed",
      metadata: expect.objectContaining({ source: "agent_policy_autonomous_send" }),
    }));
  });

  it("fails closed with template_required when the 24-hour window is closed", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "account-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "action-1", status: "pending" }] })
      // No recent inbound message.
      .mockResolvedValueOnce({ rows: [] })
      // requires_template transition.
      .mockResolvedValueOnce({ rows: [{ id: "action-1" }] });

    const result = await createWhatsAppSendApprovalTool().execute({
      account_id: "account-1", to: "+919876543210",
      payload_type: "text", body: "Outside window",
    }, context);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("template_required");
    expect(mocks.queueWhatsAppOutboundMessage).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls[3][0]).toContain("requires_template");
  });

  it("never queues when the saved policy flag is disabled", async () => {
    mocks.policy.mockResolvedValue({ securityPolicy: {}, allowedTools: ["whatsapp.send"] });
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "account-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "action-1", status: "pending" }] });

    const result = await createWhatsAppSendApprovalTool().execute({
      account_id: "account-1", to: "+919876543210",
      payload_type: "text", body: "Needs a human",
    }, context);

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ approval_required: true, action_id: "action-1", status: "pending" });
    expect(mocks.queueWhatsAppOutboundMessage).not.toHaveBeenCalled();
  });
});
