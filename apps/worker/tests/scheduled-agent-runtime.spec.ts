import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolResult } from "@ai-comms-agent/shared";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  completeWithTools: vi.fn(),
  createEmailToolRuntime: vi.fn(),
  invokeEmailReadTool: vi.fn(),
  createWhatsAppToolRuntime: vi.fn(),
  invokeWhatsAppTool: vi.fn(),
}));

vi.mock("@ai-comms-agent/db", () => ({
  query: mocks.query,
  PostgresAgentRepository: class {},
}));

vi.mock("@ai-comms-agent/clara-core", () => ({
  claraRuntime: { completeWithTools: mocks.completeWithTools },
}));

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
    // Runtime settings lookup: no KB configured -> default.
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.createEmailToolRuntime.mockResolvedValue({ registry: { listForAgent: () => [EMAIL_TOOL] } });
    mocks.createWhatsAppToolRuntime.mockResolvedValue({ registry: { listForAgent: () => [WHATSAPP_TOOL] } });
    mocks.invokeEmailReadTool.mockImplementation(async () => okResult());
    mocks.invokeWhatsAppTool.mockImplementation(async () => failedResult("template_required"));
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

    expect(result.status).toBe("completed");
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

    expect(result.status).toBe("completed");
    expect(result.output).toContain("tool-call safety limit");
    expect(result.output).toContain("Work performed this run:");
    expect(result.toolCalls).toHaveLength(12);
  });
});
