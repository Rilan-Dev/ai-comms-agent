import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolResult } from "@ai-comms-agent/shared";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  completeWithTools: vi.fn(),
  createEmailToolRuntime: vi.fn(),
  invokeEmailReadTool: vi.fn(),
  createWhatsAppToolRuntime: vi.fn(),
  invokeWhatsAppTool: vi.fn(),
  prepare:vi.fn(),user:vi.fn(),membership:vi.fn(),permissions:vi.fn(),
}));

vi.mock("@ai-comms-agent/db", () => ({
  expandAuthorizedMentions:async ({text}:{text:string})=>text,
  query: mocks.query,
  PostgresAgentRepository: class {},
  PostgresIdentityRepository:class{getUserById=mocks.user;getMembership=mocks.membership;getPermissionsForRole=mocks.permissions;},
}));

vi.mock("@ai-comms-agent/agent-core", () => ({
  agentRuntime: { completeWithTools: mocks.completeWithTools },
}));
vi.mock('@ai-comms-agent/email-agent-runtime',()=>({prepareAgentConfigurationTurn:mocks.prepare}));

vi.mock("../src/agent/email-tool-runtime", () => ({
  createEmailToolRuntime: mocks.createEmailToolRuntime,
  invokeEmailReadTool: mocks.invokeEmailReadTool,
}));

vi.mock("../src/agent/whatsapp-tool-runtime", () => ({
  createWhatsAppToolRuntime: mocks.createWhatsAppToolRuntime,
  invokeWhatsAppTool: mocks.invokeWhatsAppTool,
}));

import { runScheduledAgentTask } from "../src/agent/scheduled-agent-runtime";

const EMAIL_TOOL = { name: "email.messages.list", description: "list", input_schema: {}, required_permission: "email.read" };
const WHATSAPP_TOOL = { name: "whatsapp.send", description: "send", input_schema: {}, required_permission: "whatsapp.send" };

const okResult = (): ToolResult => ({ ok: true, output: { count: 2 }, audit: { duration_ms: 5 } });
const failedResult = (code: string): ToolResult => ({
  ok: false,
  error: { code, message: "blocked", retryable: false },
  audit: { duration_ms: 4 },
});

function completion(text: string, toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>) {
  return { text, toolCalls };
}

describe("runScheduledAgentTask result reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.completeWithTools.mockReset();mocks.user.mockResolvedValue({status:'active'});mocks.membership.mockResolvedValue({status:'active',role:'member'});mocks.permissions.mockResolvedValue(['organization.read','email.read']);
    // Runtime settings lookup: no KB configured -> default.
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.createEmailToolRuntime.mockResolvedValue({ registry: { listForAgent: () => [EMAIL_TOOL] } });
    mocks.createWhatsAppToolRuntime.mockResolvedValue({ registry: { listForAgent: () => [WHATSAPP_TOOL] } });
    mocks.invokeEmailReadTool.mockImplementation(async () => okResult());
    mocks.invokeWhatsAppTool.mockImplementation(async () => failedResult("template_required"));
  });
  afterEach(()=>vi.unstubAllEnvs());

  it('uses the saved revision and actual creator permissions without inventing send access',async()=>{
    vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','true');const agentContext={orgId:'org-1',agentId:'agent-1',kbId:'default'};
    mocks.prepare.mockResolvedValue({agentContext,configuration:{organizationId:'org-1',agentId:'agent-1',revisionId:'frozen',revocationGeneration:0,snapshot:{lifecycle:{status:'active'},policy:{allowedTools:['email.messages.list','whatsapp.send']}}}});
    mocks.completeWithTools.mockResolvedValueOnce(completion('',[{id:'read',name:'email.messages.list',arguments:{}}])).mockResolvedValueOnce(completion('Source-backed digest',[]));
    const result=await runScheduledAgentTask({organizationId:'org-1',agentId:'agent-1',executionId:'execution',userId:'user',task:'Summarize unread mail'});
    expect(result.output).toBe('Source-backed digest');expect(mocks.completeWithTools.mock.calls[0]?.[0]).toBe(agentContext);expect(mocks.completeWithTools.mock.calls[1]?.[0]).toBe(agentContext);
    expect(mocks.completeWithTools.mock.calls[0]?.[2].map((tool:{name:string})=>tool.name)).toEqual(['email.messages.list']);
    expect(mocks.invokeEmailReadTool.mock.calls[0]?.[3]).toMatchObject({agent_configuration:{revisionId:'frozen'},auth_subject:{role:'member',permissions:['email.read']}});expect(mocks.invokeWhatsAppTool).not.toHaveBeenCalled();
  });
  it('blocks configuration-bound schedules whose original creator is no longer active',async()=>{
    vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','true');mocks.user.mockResolvedValue({status:'suspended'});
    const result=await runScheduledAgentTask({organizationId:'org-1',agentId:'agent-1',executionId:'execution',userId:'user',task:'Summarize unread mail'});
    expect(result.status).toBe('configuration_required');expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.completeWithTools).not.toHaveBeenCalled();
  });

  it("returns the model's final report when the loop completes normally", async () => {
    mocks.completeWithTools
      .mockResolvedValueOnce(completion("", [{ id: "c1", name: "email.messages.list", arguments: {} }]))
      .mockResolvedValueOnce(completion("Digest: 3 unread emails summarized.", []));

    const result = await runScheduledAgentTask({
      organizationId: "org-1", agentId: "agent-1", executionId: "exec-1",
      task: "Summarize unread emails and send a note to WhatsApp.",
    });

    expect(result.status).toBe("completed");
    expect(result.output).toBe("Digest: 3 unread emails summarized.");
    expect(result.toolCalls).toHaveLength(1);
  });

  it("replays original Gemini-signed model parts in a scheduled follow-up", async () => {
    const parts = [{ functionCall: { name: "email.messages.list", args: {} },
      thoughtSignature: "opaque-provider-signature" }];
    mocks.completeWithTools
      .mockResolvedValueOnce({
        text: "", toolCalls: [{ id: "gemini-call", name: "email.messages.list", arguments: {},
          thoughtSignature: "opaque-provider-signature" }], geminiParts: parts,
      })
      .mockResolvedValueOnce(completion("A safe source-backed report.", []));

    const result = await runScheduledAgentTask({
      organizationId: "org-1", agentId: "agent-1", executionId: "signed-gemini",
      task: "Read-only summary, do not send WhatsApp.",
    });
    expect(result.status).toBe("completed");
    expect(result.output).toBe("A safe source-backed report.");
    expect(mocks.completeWithTools).toHaveBeenCalledTimes(2);
    const secondHistory = mocks.completeWithTools.mock.calls[1]?.[1];
    expect(secondHistory[2]).toMatchObject({
      role: "assistant", geminiParts: parts,
      tool_calls: [{ name: "email.messages.list", thoughtSignature: "opaque-provider-signature" }],
    });
    expect(secondHistory[3]).toMatchObject({ role: "tool", name: "email.messages.list" });
    expect(mocks.invokeWhatsAppTool).not.toHaveBeenCalled();
  });

  it("allows a provider-approved human review to remain pending without classifying a failed send", async () => {
    mocks.invokeWhatsAppTool.mockResolvedValueOnce({ok:true,output:{status:"pending_approval",approval_required:true,action_id:"approval-qa"},audit:{duration_ms:2}});
    mocks.completeWithTools
      .mockResolvedValueOnce(completion("",[{id:"send",name:"whatsapp.send",arguments:{}}]))
      .mockResolvedValueOnce(completion("WhatsApp request is pending human approval; nothing was sent.",[]));
    const result=await runScheduledAgentTask({organizationId:"org-1",agentId:"agent-1",executionId:"approval-pending",task:"Prepare an email summary for WhatsApp approval"});
    expect(result.status).toBe("completed");
    expect(result.pendingApprovals).toEqual([{actionId:"approval-qa",actionType:"whatsapp.send"}]);
    expect(result.toolCalls).toEqual([{name:"whatsapp.send",ok:true,durationMs:2}]);
  });

  it("never records an empty or malformed provider decision as a successful scheduled run", async () => {
    mocks.completeWithTools.mockResolvedValue({ text: "", toolCalls: [], finishReason: "invalid_tool_call" });
    const result = await runScheduledAgentTask({ organizationId:"org-1",agentId:"agent-1",executionId:"empty-output", task:"Produce a verified summary" });
    expect(result.status).toBe("configuration_required");
    expect(result.reason).toMatch(/provider|incomplete|invalid/i);
    expect(result.toolCalls).toEqual([]);
  });

  it("reports a blocked provider send as failed even if the model offers a final explanation", async () => {
    mocks.completeWithTools
      .mockResolvedValueOnce(completion("",[{id:"send",name:"whatsapp.send",arguments:{}}]))
      .mockResolvedValueOnce(completion("WhatsApp was blocked by the provider.",[]));
    const result = await runScheduledAgentTask({ organizationId:"org-1",agentId:"agent-1",executionId:"blocked-send",task:"Send my unread email summary on WhatsApp" });
    expect(result.output).toMatch(/blocked by the provider/i);
    expect(result.status).toBe("configuration_required");
    expect(result.reason).toMatch(/whatsapp.send|tool/i);
  });

  it("records a factual work recap when the round limit is hit after a blocked send", async () => {
    // The real-world failure shape: reads succeed, the WhatsApp send is blocked
    // by Meta's 24-hour window, the model retries and burns every round.
    const rounds = [
      completion("", [{ id: "c1", name: "email.messages.list", arguments: {} }]),
      completion("", [{ id: "c2", name: "email.messages.list", arguments: {} }]),
      completion("", [{ id: "c3", name: "whatsapp.send", arguments: {} }]),
      completion("", [{ id: "c4", name: "whatsapp.send", arguments: {} }]),
      completion("", [{ id: "c5", name: "whatsapp.send", arguments: {} }]),
      completion("", [{ id: "c6", name: "whatsapp.send", arguments: {} }]),
    ];
    for (const round of rounds) mocks.completeWithTools.mockResolvedValueOnce(round);

    const result = await runScheduledAgentTask({
      organizationId: "org-1", agentId: "agent-1", executionId: "exec-2",
      task: "Summarize unread emails and send a note to WhatsApp.",
    });

    expect(result.status).toBe("configuration_required");
    expect(result.reason).toMatch(/round limit|incomplete|tool/i);
    expect(result.output).toContain("reached its reasoning round limit");
    expect(result.output).toContain("Work performed this run:");
    expect(result.output).toContain("email.messages.list (ok)");
    expect(result.output).toContain("whatsapp.send (failed: template_required)");
    expect(result.toolCalls).toHaveLength(6);
    // Extra rounds exist so a blocked send plus retry still leaves a wrap-up
    // round for the final report.
    expect(mocks.completeWithTools).toHaveBeenCalledTimes(6);
  });

  it("records a factual work recap when the tool-call safety cap stops the run", async () => {
    // Three tool calls per round: the 13th call trips MAX_TOOL_CALLS = 12.
    for (let i = 0; i < 6; i += 1) {
      mocks.completeWithTools.mockResolvedValueOnce(completion("", [
        { id: `a${i}`, name: "email.messages.list", arguments: {} },
        { id: `b${i}`, name: "email.messages.list", arguments: {} },
        { id: `c${i}`, name: "email.messages.list", arguments: {} },
      ]));
    }

    const result = await runScheduledAgentTask({
      organizationId: "org-1", agentId: "agent-1", executionId: "exec-3",
      task: "Summarize unread emails.",
    });

    expect(result.status).toBe("configuration_required");
    expect(result.reason).toMatch(/tool.call safety limit/i);
    expect(result.output).toContain("tool-call safety limit");
    expect(result.output).toContain("Work performed this run:");
    expect(result.toolCalls).toHaveLength(12);
  });
});
