import { NextResponse } from "next/server";
import { PostgresAgentRepository, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import type { ToolContext } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { createEmailToolRuntime, invokeEmailReadTool } from "../../../../../../../apps/worker/src/agent/email-tool-runtime";
import { mailComposeReadiness, selectPreferredComposeMailbox } from "@/lib/mail/compose-readiness";

export const dynamic = "force-dynamic";

function bounded(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

async function trustedContext(request: Request, organizationId: string, agentId: string) {
  const subject = await authorize(request,
    { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
    getIdentityAdapter(), getIdentityRepository());
  const membership = subject.membership;
  if (!membership) throw new Error("An active organization membership is required.");
  const agent = await new PostgresAgentRepository().get(organizationId, agentId);
  if (!agent) return null;
  return { subject, membership, agent };
}

async function primaryMailboxes(organizationId: string, agentId: string) {
  const result = await query<{ id: string; email_address: string; capabilities: unknown }>(
    `SELECT a.id,a.email_address::text AS email_address,a.capabilities
     FROM agent_email_accounts b
     JOIN agents g ON g.id=b.agent_id AND g.organization_id=$1
     JOIN email_accounts a ON a.id=b.email_account_id AND a.organization_id=$1
     WHERE b.agent_id=$2 AND b.role='primary'
       AND a.status='connected' AND a.deleted_at IS NULL
     ORDER BY a.email_address LIMIT 30`, [organizationId,agentId],
  );
  return result.rows.map(row => ({
    id: String(row.id), address: String(row.email_address),
    capabilities: row.capabilities && typeof row.capabilities === "object" && !Array.isArray(row.capabilities)
      ? row.capabilities as Record<string, unknown> : {} as Record<string, unknown>,
  }));
}

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const queryParams = new URL(request.url).searchParams;
    const organizationId = bounded(queryParams.get("organizationId"), 100);
    const agentId = bounded(queryParams.get("agentId"), 100);
    if (!organizationId || !agentId) return NextResponse.json({ error: "validation_error" }, { status: 422 });
    const trusted = await trustedContext(request, organizationId, agentId);
    if (!trusted) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const runtime = await createEmailToolRuntime(organizationId, agentId);
    const allowed = runtime.registry.listForAgent(agentId);
    const mailboxes = await primaryMailboxes(organizationId, agentId);
    // Each selectable account must pass its OWN discovered capability checks.
    // A capable mailbox must never make a different one look authorized.
    const baseline = {
      actorCanWrite: trusted.subject.permissions.has("email.write"),
      draftToolEnabled: allowed.some(tool => tool.name === "email.draft.create"),
      sendRequestToolEnabled: allowed.some(tool => tool.name === "email.send.request"),
    };
    const choices = mailboxes.map(mailbox => {
      const readiness = mailComposeReadiness({
        ...baseline, hasBoundPrimaryMailbox: true,
        providerCanDraft: mailbox.capabilities.drafts === true,
        providerCanSend: mailbox.capabilities.send === true,
      });
      return {
        id: mailbox.id, address: mailbox.address,
        canDraft: readiness.canDraft,
        canRequestApproval: readiness.canRequestApproval,
        blockers: readiness.blockers,
      };
    });
    const empty = mailComposeReadiness({
      ...baseline, hasBoundPrimaryMailbox: false, providerCanDraft: false, providerCanSend: false,
    });
    const preferred = selectPreferredComposeMailbox(choices);
    // These are read-only hints, not grants. POST rechecks authorization and
    // provider capabilities even if they change after this response.
    return NextResponse.json({
      mailboxes: choices,
      canDraft: preferred?.canDraft ?? empty.canDraft,
      canRequestApproval: preferred?.canRequestApproval ?? empty.canRequestApproval,
      blockers: preferred?.blockers ?? empty.blockers,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = bounded(body?.organizationId, 100);
    const agentId = bounded(body?.agentId, 100);
    const accountId = bounded(body?.accountId, 100);
    const action = body?.action;
    if (!organizationId || !agentId || !accountId || (action !== "draft" && action !== "request_approval"))
      return NextResponse.json({ error: "validation_error", message: "Agent, connected mailbox and supported action are required." }, { status: 422 });
    const trusted = await trustedContext(request, organizationId, agentId);
    if (!trusted) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // Fail closed: an agent-bound, connected, primary mailbox is mandatory.
    // The tool executor independently revalidates policy, schema and capability.
    const bound = await primaryMailboxes(organizationId, agentId);
    if (!bound.some(account => account.id === accountId)) return NextResponse.json({ error: "mailbox_not_available", message: "Choose a connected primary mailbox assigned to this agent." }, { status: 403 });

    const draftId = bounded(body?.draftId, 100);
    if (action === "request_approval" && !draftId) return NextResponse.json({ error: "validation_error", message: "Save a draft before requesting send approval." }, { status: 422 });
    const context: ToolContext = {
      organization_id: organizationId, agent_id: agentId, user_id: trusted.subject.user.id,
      // Never trust a client-provided conversation ID as an authorization fact.
      conversation_id: crypto.randomUUID(),
      // One saved draft represents one reviewable approval request. A lost
      // response or double click reuses the DB idempotency key, not a new send.
      turn_id: action === "request_approval" ? `chat-draft:${agentId}:${draftId}` : crypto.randomUUID(),
      correlation_id: crypto.randomUUID(), channel: "chat",
      auth_subject: {
        user_id: trusted.subject.user.id, role: trusted.membership.role,
        permissions: [...trusted.subject.permissions],
      },
    };
    const runtime = await createEmailToolRuntime(organizationId, agentId);
    const toolName = action === "draft" ? "email.draft.create" : "email.send.request";
    const recipient = bounded(body?.to, 320);
    const subject = bounded(body?.subject, 998);
    const bodyText = bounded(body?.bodyText, 100000);
    if (action === "draft" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || !subject || !bodyText))
      return NextResponse.json({ error: "validation_error", message: "A valid recipient, subject and email body are required." }, { status: 422 });

    const input = action === "draft"
      ? { account_id: accountId, to: [recipient], subject, body_text: bodyText }
      : { account_id: accountId, draft_id: draftId };
    const result = await invokeEmailReadTool(runtime, toolName, input, context);
    if (!result.ok) return NextResponse.json({ error: result.error?.code ?? "tool_denied",
      message: result.error?.message ?? "The agent is not authorized to perform this email operation." }, { status: 403 });
    const output = result.output && typeof result.output === "object" && !Array.isArray(result.output)
      ? result.output as Record<string, unknown> : {};
    const expected = action === "draft" ? "draft_created" : "pending_approval";
    if (output.status !== expected) return NextResponse.json({ error: "unexpected_tool_result" }, { status: 502 });
    return NextResponse.json({
      status: output.status,
      ...(action === "draft" ? { draftId: output.draft_id } : { actionId: output.action_id }),
      message: action === "draft"
        ? "Draft saved to the selected mailbox. It has not been sent."
        : "Send approval requested. The email has not been sent.",
    });
  } catch (error) { return authorizationErrorToResponse(error); }
}
