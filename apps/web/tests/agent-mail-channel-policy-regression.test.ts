import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = readFileSync(resolve(__dirname, "../../../packages/db/src/agent/repository.ts"), "utf8");
const channels = readFileSync(resolve(__dirname, "../src/app/api/agents/[id]/channels/route.ts"), "utf8");
const chat = readFileSync(resolve(__dirname, "../src/app/api/chat/stream/route.ts"), "utf8");
const details = readFileSync(resolve(__dirname, "../src/app/agents/[id]/agent-detail-client.tsx"), "utf8");

describe("FIX-01 agent mailbox channels and summary authorization", () => {
  it("removes a binding with a PostgreSQL-valid, organization- and agent-scoped DELETE", () => {
    const unbind = repo.slice(repo.indexOf("async unbindEmail("), repo.indexOf("async whatsappAccounts("));
    expect(unbind).toContain("DELETE FROM agent_email_accounts b USING agents a, email_accounts ea WHERE");
    expect(unbind).not.toMatch(/JOIN email_accounts ea ON ea\.id=b\.email_account_id/);
    expect(unbind).toContain("b.agent_id=a.id");
    expect(unbind).toContain("b.email_account_id=ea.id");
    expect(unbind).toContain("a.organization_id=$1 AND a.id=$2");
    expect(unbind).toContain("ea.organization_id=$1 AND b.email_account_id=$3");
    expect(unbind).toContain("[orgId,id,emailAccountId]");
  });

  it("keeps channel mutation administrator-only and does not auto-enable email tools", () => {
    expect(channels).toContain('role: "admin"');
    expect(channels).toContain('body?.action === "unbind_email"');
    expect(channels).toContain("repo.unbindEmail(orgId, id, body.emailAccountId.trim())");
    expect(channels).not.toContain("updatePolicy(");
  });

  it("requires email.read plus an explicitly enabled registered search/list tool", () => {
    const scope = chat.slice(chat.indexOf("if (requestedMailScope) {"), chat.indexOf("const rows = await query<RollingMailRow>"));
    expect(scope).toContain('subject.permissions.has("email.read")');
    expect(scope).toContain("createEmailToolRuntime(organizationId, agentId)");
    expect(scope).toContain("mailRuntime.registry.listForAgent(agentId)");
    expect(scope).toContain('tool.name === "email.search" || tool.name === "email.messages.list"');
    expect(scope).toContain("Connecting an email account alone does not enable tools.");
    expect(chat).toContain("b.role IN ('primary', 'read_only')");
  });

  it("explains the independent allowlist gate in the channels and policy UI", () => {
    expect(details).toContain('role="status"');
    expect(details).toContain("Mailbox connection does not enable chat summaries.");
    expect(details).toContain('onClick={()=>setTab("policy")}');
    expect(details).toContain('name: "email.search", label: "Search mailbox"');
    expect(details).toContain('name: "email.messages.list", label: "List emails"');
    expect(details).toContain('const [selectedTools, setSelectedTools] = useState<string[]>(initialPolicy?.allowedTools ?? [])');
    expect(details).toContain('const allowedTools = selectedTools');
    expect(details).toContain('onChange={(event) => togglePolicyTool(choice.name, event.target.checked)}');
    expect(details).toContain('setSelectedTools(p.policy.allowedTools)');
    expect(details).not.toContain('name="allowedTools"');
  });
  it("keeps existing special policy settings and grants until explicitly changed", () => {
    expect(details).toContain('Nothing is enabled unless an administrator selects it and saves the policy.');
    expect(details).toContain('KNOWN_EMAIL_POLICY_TOOLS.has(name)');
    expect(details).toContain('Existing other permissions');
    expect(details).toContain('checked onChange={() => togglePolicyTool(name, false)}');
    expect(details).toContain('policy?.securityPolicy??{}');
    expect(details).toContain('policy?.rateLimits??{}');
    expect(details).toContain('role !== "send_only"');
    expect(details).toContain("Binding a mailbox never grants tool access automatically.");
    expect(details).toContain("Save selected permissions");
    expect(channels).not.toContain("updatePolicy(");
  });

});
