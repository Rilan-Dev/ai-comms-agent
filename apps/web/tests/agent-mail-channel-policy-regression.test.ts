import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = readFileSync(resolve(__dirname, "../../../packages/db/src/agent/repository.ts"), "utf8");
const channels = readFileSync(resolve(__dirname, "../src/app/api/agents/[id]/channels/route.ts"), "utf8");
const chat = readFileSync(resolve(__dirname, "../src/app/api/chat/stream/route.ts"), "utf8");
const details = readFileSync(resolve(__dirname, "../src/app/agents/[id]/agent-detail-client.tsx"), "utf8");
const policyRoute = readFileSync(resolve(__dirname, "../src/app/api/agents/[id]/policy/route.ts"), "utf8");
const mailReadTools = readFileSync(resolve(__dirname, "../../../packages/email-agent-runtime/src/email-read-tools.ts"), "utf8");
const mailWriteTools = readFileSync(resolve(__dirname, "../../../packages/email-agent-runtime/src/email-write-tools.ts"), "utf8");
const simulate = readFileSync(resolve(__dirname, "../src/app/api/agents/[id]/simulate/route.ts"), "utf8");

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

  it("only offers working mail tools as selectable options, not unregistered catalog contracts", () => {
    const names = Array.from(details.matchAll(/\\{ name: "(email\\.[^"]+)", label: /g), (match) => match[1]);
    const registered = new Set([
      ...Array.from(mailReadTools.matchAll(/readTool\\("(email\\.[^"]+)"/g), (match) => match[1]),
      ...Array.from(mailWriteTools.matchAll(/makeTool\\("(email\\.[^"]+)"/g), (match) => match[1]),
    ]);
    expect(names.length).toBeGreaterThanOrEqual(10);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(registered.has(name)).toBe(true);
    expect(names).toContain("email.search");
    expect(names).toContain("email.messages.list");
    expect(names).not.toContain("email.summarize");
  });

  it("includes a click-through setup sequence and does not require ordinary users to edit JSON", () => {
    expect(details).toContain("Get your agent ready");
    expect(details).toContain("1. Choose a mailbox");
    expect(details).toContain("2. Select permissions");
    expect(details).toContain("3. Check readiness");
    expect(details).toContain("Advanced: edit technical version JSON (optional)");
    expect(details).toContain("Advanced sender rules and existing custom policy (optional)");
    expect(details).toContain("The checklist reflects saved configuration, not a live connection or successful mail import.");
  });

  it("refuses unavailable mailbox bindings both in UI and at the tenant-scoped server boundary", () => {
    expect(details).toContain('disabled={account.status !== "connected"}');
    expect(details).toContain("Only connected mailboxes can be assigned.");
    expect(channels).toContain("const selectedAccount = await new PostgresEmailAccountRepository().getById");
    expect(channels).toContain('selectedAccount.organization_id !== orgId || selectedAccount.status !== "connected"');
    expect(channels).toContain('status: 422');
    const repoBind = repo.slice(repo.indexOf("async bindEmail("), repo.indexOf("async unbindEmail("));
    expect(repoBind).toContain("ea.deleted_at IS NULL AND ea.status='connected'");
    expect(policyRoute).toContain('role: "admin"');
    expect(channels).toContain('role: "admin"');
  });

  it("reports mail-read readiness only for a connected readable account in the same organization", () => {
    expect(simulate).toContain('name === "email.search" || name === "email.messages.list"');
    expect(simulate).toContain("const readableMailbox = mailSummaryEnabled ? await query");
    expect(simulate).toContain("ag.organization_id=$2 AND ea.organization_id=$2");
    expect(simulate).toContain("ea.deleted_at IS NULL AND ea.status='connected'");
    expect(simulate).toContain("b.role IN ('primary','read_only')");
    expect(simulate).toContain('key: "mail_readiness"');
    expect(simulate).toContain('ok: !mailSummaryEnabled || Boolean(readableMailbox?.rows[0])');
    expect(simulate).not.toContain("updatePolicy(");
    expect(details).toContain('{c.detail && <span');
  });

});
