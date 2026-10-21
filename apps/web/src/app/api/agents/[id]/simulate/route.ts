import { NextResponse } from "next/server";
import { PostgresAgentRepository, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for agent tests." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const repo = new PostgresAgentRepository();
    const agent = await repo.get(organizationId, id);
    if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const [versions, policy, bindings, whatsappBinding] = await Promise.all([repo.versions(organizationId, id), repo.policy(organizationId, id), repo.emailBindings(organizationId, id), repo.whatsappBinding(organizationId, id)]);
    const current = versions.find((v) => v.id === agent.currentVersionId) ?? versions[0] ?? null;
    // Do not report a configured mail-reading agent as ready if it has no
    // active readable mailbox. This is a read-only configuration check, not
    // a provider connection test, a policy grant, or permission escalation.
    const mailSummaryEnabled = Boolean(policy?.allowedTools.some((name) => name === "email.search" || name === "email.messages.list"));
    const readableMailbox = mailSummaryEnabled ? await query<{ id: string }>(
      `SELECT ea.id FROM agent_email_accounts b
       JOIN email_accounts ea ON ea.id = b.email_account_id
       JOIN agents ag ON ag.id = b.agent_id
       WHERE b.agent_id=$1 AND ag.organization_id=$2 AND ea.organization_id=$2
         AND ea.deleted_at IS NULL AND ea.status='connected'
         AND b.role IN ('primary','read_only')
       LIMIT 1`,
      [id, organizationId],
    ) : null;
    const checks = [
      { key: "agent", label: "Agent record exists", ok: true },
      { key: "version", label: "At least one configuration version exists", ok: Boolean(current) },
      { key: "policy", label: "Security policy exists", ok: Boolean(policy) },
      { key: "email", label: "Email channel binding is optional", ok: true, detail: bindings.length ? `${bindings.length} email binding(s)` : "Not connected" },
      { key: "mail_readiness", label: "Mail-summary permissions match a connected readable mailbox", ok: !mailSummaryEnabled || Boolean(readableMailbox?.rows[0]), detail: !mailSummaryEnabled ? "Mail search/list permissions are not enabled." : readableMailbox?.rows[0] ? "Configured mailbox is connected; provider sync is checked separately." : "Select a connected readable mailbox in Channels or disable unused mail-read permissions." },
      { key: "whatsapp", label: "WhatsApp binding is valid", ok: !whatsappBinding || Boolean(whatsappBinding.whatsappAccountId), detail: whatsappBinding ? "One account connected" : "Not connected" },
    ];
    return NextResponse.json({ ok: checks.every((c) => c.ok), checks, agentId: id });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
