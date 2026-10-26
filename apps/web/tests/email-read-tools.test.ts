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
  it('does not read an account granted after the turn began',async()=>{
    queryMock.mockReset();queryMock.mockResolvedValue({rows:[{role:'primary'}]});
    const accounts={getForAgent:vi.fn().mockResolvedValue(account)};
    const tools=createEmailReadTools({accounts:accounts as unknown as PostgresEmailAccountRepository});
    const frozen={...context,agent_configuration:{organizationId:'org-1',agentId:'agent-1',revisionId:'revision',snapshot:{channels:{email:[],whatsappAccountId:null}} as never}};
    const result=await tools.find(tool=>tool.name==='email.capabilities.get')!.execute({account_id:'10000000-0000-4000-8000-000000000001'},frozen);
    expect(result.error?.code).toBe('account_not_available');expect(accounts.getForAgent).not.toHaveBeenCalled();
  });
  it('keeps discovery within the frozen readable accounts even when live bindings broaden',async()=>{
    const accounts={getForAgent:vi.fn().mockImplementation(async(_org,_agent,id)=>({id,provider:'gmail'}))};
    const agents={emailBindings:vi.fn().mockResolvedValue([{emailAccountId:'old',role:'primary'},{emailAccountId:'new',role:'primary'},{emailAccountId:'was-send-only',role:'primary'}])};
    const tools=createEmailReadTools({accounts:accounts as unknown as PostgresEmailAccountRepository,agents:agents as unknown as PostgresAgentRepository});
    const frozen={...context,agent_configuration:{organizationId:'org-1',agentId:'agent-1',revisionId:'revision',snapshot:{channels:{email:[{accountId:'old',role:'read_only'},{accountId:'was-send-only',role:'send_only'}],whatsappAccountId:null}} as never}};
    const result=await tools.find(tool=>tool.name==='email.accounts.list')!.execute({},frozen);
    expect(result.ok).toBe(true);expect(result.output).toEqual([expect.objectContaining({id:'old'})]);expect(accounts.getForAgent).toHaveBeenCalledTimes(1);
  });
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
    // "account-1" is not a UUID, so the account identifier resolver query
    // runs FIRST (resolving the label through the binding scope), then the
    // binding-role query. Mock both in order.
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "account-1" }] }) // resolver: label -> account-1
      .mockResolvedValueOnce({ rows: [{ role: "read_only" }] }); // binding role
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

  it("resolves an email-address account_id through the binding scope instead of throwing a uuid syntax error", async () => {
    // Regression for the live bug: the model passed the mailbox address
    // (e.g. "user@gmail.com") as account_id; the raw uuid comparison threw
    // "invalid input syntax for type uuid" and the executor surfaced the
    // cryptic authorization_unavailable error. The address must resolve to
    // the bound account and the tool must succeed.
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "account-uuid-1" }] }) // resolver: email -> uuid
      .mockResolvedValueOnce({ rows: [{ role: "primary" }] }); // binding role
    const accounts = { getForAgent: vi.fn().mockResolvedValue(account) };
    const tools = createEmailReadTools({
      accounts: accounts as unknown as PostgresEmailAccountRepository,
      agents: { emailBindings: vi.fn() } as unknown as PostgresAgentRepository,
      folders: { listLabels: vi.fn() } as unknown as PostgresEmailFolderLabelRepository,
    });
    const tool = tools.find((item) => item.name === "email.capabilities.get")!;
    const result = await tool.execute({ account_id: "user@gmail.com" }, context);
    expect(result.ok).toBe(true);
    // The downstream account lookup must use the RESOLVED uuid, never the raw address.
    expect(accounts.getForAgent).toHaveBeenCalledWith("org-1", "agent-1", "account-uuid-1");
  });

  it("denies an unresolvable account_id cleanly instead of throwing authorization_unavailable", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }); // resolver: no matching bound mailbox
    const accounts = { getForAgent: vi.fn() };
    const tools = createEmailReadTools({
      accounts: accounts as unknown as PostgresEmailAccountRepository,
      agents: { emailBindings: vi.fn() } as unknown as PostgresAgentRepository,
      folders: { listLabels: vi.fn() } as unknown as PostgresEmailFolderLabelRepository,
    });
    const tool = tools.find((item) => item.name === "email.capabilities.get")!;
    const result = await tool.execute({ account_id: "not-a-real-mailbox" }, context);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("account_not_available");
    expect(accounts.getForAgent).not.toHaveBeenCalled();
  });
});
