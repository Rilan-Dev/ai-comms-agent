import { afterEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@ai-comms-agent/db", () => ({
  query: queryMock,
  PostgresEmailAccountRepository: class {},
  PostgresAgentRepository: class {},
  PostgresEmailFolderLabelRepository: class {},
  getMailMessageForOrganization: vi.fn(),
  getMailThreadForOrganization: vi.fn(),
  listMailFoldersForOrganization: vi.fn(),
}));

import { createEmailReadTools } from "../../../apps/worker/src/agent/email-read-tools";
import type { PostgresEmailAccountRepository, PostgresAgentRepository, PostgresEmailFolderLabelRepository } from "@ai-comms-agent/db";

const account = {
  id: "account-1", organization_id: "org-1", provider: "gmail", email_address: "private@example.com",
  capabilities: { folders: true, labels: true, threads: true }, status: "connected",
} as never;
const context = {
  agent_id: "agent-1", organization_id: "org-1", user_id: "user-1",
  conversation_id: "conversation-1", turn_id: "turn-1", correlation_id: "corr-1",
  channel: "chat" as const,
  auth_subject: { user_id: "user-1", role: "member" as const, permissions: ["email.read"] },
};

describe("email read tools", () => {
  afterEach(() => vi.clearAllMocks());

  it("denies reads before touching account data when permission is missing", async () => {
    const tools = createEmailReadTools({
      accounts: { getForAgent: vi.fn() } as unknown as PostgresEmailAccountRepository,
      agents: { emailBindings: vi.fn() } as unknown as PostgresAgentRepository,
      folders: { listLabels: vi.fn() } as unknown as PostgresEmailFolderLabelRepository,
    });
    const tool = tools.find((item) => item.name === "email.capabilities.get")!;
    const result = await tool.execute({ account_id: "account-1" }, {
      ...context, auth_subject: { ...context.auth_subject, permissions: [] },
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("permission_denied");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("refuses a mailbox bound only for sending", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ role: "send_only" }] });
    const accounts = { getForAgent: vi.fn().mockResolvedValue(account) };
    const tools = createEmailReadTools({
      accounts: accounts as unknown as PostgresEmailAccountRepository,
      agents: { emailBindings: vi.fn() } as unknown as PostgresAgentRepository,
      folders: { listLabels: vi.fn() } as unknown as PostgresEmailFolderLabelRepository,
    });
    const tool = tools.find((item) => item.name === "email.capabilities.get")!;
    const result = await tool.execute({ account_id: "account-1" }, context);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("account_not_available");
    expect(accounts.getForAgent).not.toHaveBeenCalled();
  });

  it("rechecks organization, agent and account binding before returning capabilities", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ role: "read_only" }] });
    const accounts = { getForAgent: vi.fn().mockResolvedValue(account) };
    const tools = createEmailReadTools({
      accounts: accounts as unknown as PostgresEmailAccountRepository,
      agents: { emailBindings: vi.fn() } as unknown as PostgresAgentRepository,
      folders: { listLabels: vi.fn() } as unknown as PostgresEmailFolderLabelRepository,
    });
    const tool = tools.find((item) => item.name === "email.capabilities.get")!;
    const result = await tool.execute({ account_id: "account-1" }, context);
    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({ account_id: "account-1", provider: "gmail" });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("agent_email_accounts"), ["agent-1", "org-1", "account-1"]);
  });
});
