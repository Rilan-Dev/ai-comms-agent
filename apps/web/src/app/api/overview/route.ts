import { NextResponse } from "next/server";
import { query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { briefingsEnabled } from "@/lib/briefings/config";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for the overview." }, { status: 503 });
    const url = new URL(request.url);
    const authenticated = await getIdentityAdapter().resolveUser(request);
    const memberships = authenticated ? await getIdentityRepository().getMembershipsForUser(authenticated.id) : [];
    const rawId = url.searchParams.get("organizationId")?.trim() || memberships.find((m) => m.status === "active")?.organizationId;
    if (!rawId) return NextResponse.json({ error: "configuration_required", message: "An organization context is required." }, { status: 422 });
    const subject = await authorize(request, { organizationId: asOrganizationId(rawId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());

    const counts = await query<Record<string,unknown>>(
      "SELECT " +
      "(SELECT count(*) FROM email_messages m JOIN email_accounts a ON a.id=m.email_account_id WHERE a.organization_id=$1 AND a.deleted_at IS NULL AND m.is_read=false) AS unread_mail, " +
      "(SELECT count(*) FROM email_messages m JOIN email_accounts a ON a.id=m.email_account_id WHERE a.organization_id=$1 AND a.deleted_at IS NULL AND m.action_required=true) AS action_required, " +
      "(SELECT count(*) FROM agents WHERE organization_id=$1 AND status='active') AS active_agents, " +
      "(SELECT count(*) FROM automation_rules WHERE organization_id=$1 AND status='active') AS active_automations, " +
      "(SELECT count(*) FROM email_actions WHERE organization_id=$1 AND status='pending_approval') AS pending_approvals, " +
      "(SELECT count(*) FROM voice_sessions WHERE organization_id=$1 AND status='active' AND ended_at IS NULL) AS active_voice_sessions",
      [rawId],
    );

    const activity = await query<Record<string,unknown>>(
      "SELECT id,event_type,action,decision,created_at FROM audit_events WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 6",
      [rawId],
    );

    const row = counts.rows[0] ?? {};
    return NextResponse.json({
      organizationId: rawId,
      role: subject.membership?.role ?? null,
      catchUpAvailable: briefingsEnabled(),
      metrics: Object.fromEntries(Object.entries(row).map(([key,value]) => [key, Number(value)])),
      activity: activity.rows.map(event => ({
        id: String(event.id),
        title: String(event.event_type),
        detail: [event.action, event.decision].filter(Boolean).join(" · ") || "recorded",
        createdAt: String(event.created_at),
      })),
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
