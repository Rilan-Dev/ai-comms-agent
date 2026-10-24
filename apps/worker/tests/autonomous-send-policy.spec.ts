import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAutonomousSendEnabled } from "@ai-comms-agent/shared";
import { operationResultFromToolCall } from "@ai-comms-agent/shared";
import { formatOperationFeedback } from "@/lib/chat/operation-feedback";

const emailWriteTools = readFileSync(resolve(__dirname, "../../../packages/email-agent-runtime/src/email-write-tools.ts"), "utf8");
const currentAuthorization = readFileSync(resolve(__dirname, "../../../packages/db/src/actions/current-authorization.ts"), "utf8");
const emailActions = readFileSync(resolve(__dirname, "../../../packages/db/src/email/actions.ts"), "utf8");
const agentDetailClient = readFileSync(resolve(__dirname, "../../web/src/app/agents/[id]/agent-detail-client.tsx"), "utf8");

const context = { turn_id: "auto-turn", correlation_id: "auto-correlation" };
const actionId = "b8f22770-c484-49ac-bdcd-61ac2533a300";
const call = (name: string, output: unknown) =>
  operationResultFromToolCall({ context, callId: "call-auto", registeredName: name, result: { ok: true, output } });

describe("autonomous-send policy flag", () => {
  it("enables only on an explicit saved true flag", () => {
    expect(isAutonomousSendEnabled({ autonomous_send: true })).toBe(true);
    expect(isAutonomousSendEnabled({})).toBe(false);
    expect(isAutonomousSendEnabled({ autonomous_send: "true" })).toBe(false);
    expect(isAutonomousSendEnabled({ autonomous_send: 1 })).toBe(false);
    expect(isAutonomousSendEnabled(undefined)).toBe(false);
    expect(isAutonomousSendEnabled(null)).toBe(false);
  });
});

describe("autonomous-send operation results", () => {
  it("maps an auto-approved email send to the queued state", () => {
    const result = call("email.send.request", { status: "auto_approved", action_id: actionId, auto_approved: true })!;
    expect(result).toMatchObject({ channel: "email", operation: "send", state: "queued", resourceId: actionId });
  });
  it("maps an auto-approved WhatsApp send to the queued state", () => {
    const result = call("whatsapp.send", { status: "queued", action_id: actionId, approval_required: false, auto_approved: true })!;
    expect(result).toMatchObject({ channel: "whatsapp", operation: "send", state: "queued", resourceId: actionId });
  });
  it("does not treat a human pending approval as queued", () => {
    const result = call("email.send.request", { status: "pending_approval", action_id: actionId })!;
    expect(result.state).toBe("pending_approval");
  });
  it("requires the auto_approved marker before reporting queued", () => {
    // A malformed or foreign output claiming status=queued without the policy
    // marker must stay unconfirmed instead of implying automatic dispatch.
    const result = call("email.send.request", { status: "queued", action_id: actionId })!;
    expect(result.state).toBe("outcome_unknown");
  });
  it("renders auto-approved sends as dispatched without claiming delivery", () => {
    const result = call("email.send.request", { status: "auto_approved", action_id: actionId, auto_approved: true })!;
    const text = formatOperationFeedback([result]);
    expect(text).toContain("auto-approved");
    expect(text).toContain("queued for delivery");
    expect(text).toContain("Delivery confirmation follows");
  });
});

describe("email write tools autonomous gating", () => {
  it("auto-approves through the dedicated policy transition only after the saved policy check", () => {
    expect(emailWriteTools).toContain("maybeAutoApproveEmailAction");
    expect(emailWriteTools).toContain("isAutonomousSendEnabled(policy?.securityPolicy)");
    expect(emailWriteTools).toContain("autoApproveEmailAction(context.organization_id, action.id, context.user_id)");
  });
  it("requires both an agent and an authenticated user before auto-approval", () => {
    expect(emailWriteTools).toContain("if (!context.agent_id || !context.user_id) return false;");
  });
  it("reports every send, reply and forward path with the auto-approved status", () => {
    expect(emailWriteTools.match(/status: "auto_approved"/g)?.length).toBe(3);
    expect(emailWriteTools.match(/status: "pending_approval"/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("audits auto-approvals with a distinct event type and source", () => {
    expect(emailWriteTools).toContain('"email.action.auto_approved"');
    expect(emailWriteTools).toContain('source: "agent_policy_autonomous_send"');
  });
});

describe("auto-approval database transition", () => {
  it("keeps approved_by NULL so the dispatch-time policy recheck governs consent", () => {
    expect(emailActions).toContain("export async function autoApproveEmailAction");
    const transition = emailActions.slice(emailActions.indexOf("export async function autoApproveEmailAction"));
    expect(transition).toContain("SET status = 'approved',");
    expect(transition).not.toContain("approved_by = ");
    expect(transition).toContain("AUTO_APPROVED_MARKER");
  });
});

describe("dispatch-time authorization for policy-approved sends", () => {
  it("re-verifies the autonomous-send policy instead of a human approver", () => {
    expect(currentAuthorization).toContain("autonomousSendPolicyStillEnabled");
    expect(currentAuthorization).toContain("security.autonomous_send!==true");
    expect(currentAuthorization).toContain("if(action.approvedBy){");
  });
  it("keeps the human approver permission check for manually approved sends", () => {
    expect(currentAuthorization).toContain("await actor(action.organizationId,action.approvedBy,'organization.update');");
  });
});

describe("agent policy editor exposes the autonomous-send toggle", () => {
  it("persists the flag into the security policy on save", () => {
    expect(agentDetailClient).toContain("autonomous_send: true");
    expect(agentDetailClient).toContain("setAutonomousSend");
  });
  it("warns when enabling and confirms the change", () => {
    expect(agentDetailClient).toContain("AUTONOMOUS SENDING will be ENABLED");
    expect(agentDetailClient).toContain("Autonomous sending will be DISABLED");
  });
});
