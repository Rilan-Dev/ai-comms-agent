import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const turnRoute = readFileSync(resolve(__dirname, "../src/app/api/voice/turn/route.ts"), "utf8");
const runtime = readFileSync(resolve(__dirname, "../../../packages/email-agent-runtime/src/email-tool-runtime.ts"), "utf8");
const writeTools = readFileSync(resolve(__dirname, "../../../packages/email-agent-runtime/src/email-write-tools.ts"), "utf8");
const loop = readFileSync(resolve(__dirname, "../../../packages/email-agent-runtime/src/email-agent-loop.ts"), "utf8");
const actionWorker = readFileSync(resolve(__dirname, "../../../apps/worker/src/email/action-worker.ts"), "utf8");
const dbRepository = readFileSync(resolve(__dirname, "../../../packages/db/src/email/repository.ts"), "utf8");

describe("voice email tool runtime boundary", () => {
  it("constructs tool context from the authenticated subject, never model-supplied identity", () => {
    expect(turnRoute).toContain("runEmailAgentTurn");
    expect(turnRoute).toContain("subject.membership.role");
    expect(turnRoute).toContain("[...subject.permissions]");
    expect(turnRoute).toContain('channel: "voice"');
    expect(turnRoute).toContain("organization_id: organizationId");
    expect(turnRoute).toContain("agent_id: agentId");
    expect(turnRoute).toContain("user_id: subject.user.id");
  });

  it("rechecks persisted agent allowlist and records every tool invocation", () => {
    expect(runtime).toContain("agents.policy(organizationId, agentId)");
    expect(runtime).toContain("isEmailToolAllowedByPolicy(currentPolicy, tool.name)");
    expect(runtime).toContain("registerEmailReadTools");
    expect(runtime).toContain("registerEmailWriteTools");
    expect(runtime).toContain("recordAuditEvent");
    expect(runtime).toContain("tool.required_permission");
  });

  it("keeps email sends, replies and forwards behind explicit approval", () => {
    expect(writeTools).toContain('actionType: "send_email"');
    expect(writeTools).toContain('actionType: "reply_email"');
    expect(writeTools).toContain('actionType: "forward_email"');
    expect(writeTools).toContain('status: "pending_approval"');
    expect(writeTools).toContain("The email has not been sent.");
    expect(writeTools).toContain("The reply has not been sent.");
    expect(writeTools).toContain("The message has not been forwarded.");
    expect(writeTools).not.toContain(".sendDraft(");
    expect(writeTools).not.toContain(".reply(");
    expect(writeTools).not.toContain(".forward(");
    expect(writeTools).not.toContain("const markRead =");
    expect(writeTools).not.toContain("const archive =");
    expect(writeTools).not.toContain("const move =");
    expect(writeTools).not.toContain("const draftDelete =");
  });

  it("updates provider drafts with the latest approved content before sending", () => {
    expect(actionWorker).toContain("await connected.updateDraft(providerDraftId, params)");
    expect(actionWorker).toContain("providerDraftId = String(draft.provider_draft_id)");
    expect(dbRepository).toContain("provider_draft_sync_status = 'pending'");
  
  });

  it("bounds tool rounds and calls and treats tool output as untrusted data", () => {
    expect(loop).toContain("const MAX_ROUNDS = 4");
    expect(loop).toContain("const MAX_TOOL_CALLS = 8");
    expect(loop).toContain("execute");
    expect(loop).toContain("UNTRUSTED TOOL RESULT");
  });
});
