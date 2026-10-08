import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { query } from "@ai-comms-agent/db";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

type Check = { status: "healthy" | "degraded" | "not_configured"; detail: string };

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for operations health." }, { status: 503 });
    }
    const url = new URL(request.url);
    const authenticated = await getIdentityAdapter().resolveUser(request);
    const memberships = authenticated ? await getIdentityRepository().getMembershipsForUser(authenticated.id) : [];
    const rawId = url.searchParams.get("organizationId")?.trim() || memberships.find((m) => m.status === "active")?.organizationId;
    if (!rawId) return NextResponse.json({ error: "configuration_required", message: "An organization context is required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(rawId), permission: "audit.read" }, getIdentityAdapter(), getIdentityRepository());

    const checks: Record<string, Check> = {};
    try {
      await query("SELECT 1");
      checks.postgres = { status: "healthy", detail: "Database query succeeded." };
    } catch {
      checks.postgres = { status: "degraded", detail: "Database query failed." };
    }

    const configured = (name: string) => Boolean(process.env[name]);
    checks.redis = configured("REDIS_URL") ? { status: "healthy", detail: "Connection URL configured; runtime connectivity is worker-owned." } : { status: "not_configured", detail: "REDIS_URL is not configured." };
    checks.rabbitmq = configured("RABBITMQ_URL") ? { status: "healthy", detail: "Connection URL configured; runtime connectivity is worker-owned." } : { status: "not_configured", detail: "RABBITMQ_URL is not configured." };
    checks.qdrant = configured("QDRANT_URL") ? { status: "healthy", detail: "Connection URL configured; runtime connectivity is worker-owned." } : { status: "not_configured", detail: "QDRANT_URL is not configured." };

    const metrics = await query<{
      email_errors_24h: string;
      sync_failures_24h: string;
      active_voice_sessions: string;
      scheduled_errors: string;
      denied_audits_24h: string;
    }>(`SELECT
      (SELECT count(*) FROM email_accounts WHERE organization_id=$1 AND status='error' AND COALESCE(last_error_at, now()) >= now() - interval '24 hours') AS email_errors_24h,
      (SELECT count(*) FROM email_sync_events e JOIN email_accounts a ON a.id=e.email_account_id WHERE a.organization_id=$1 AND e.event_type='failed' AND COALESCE(e.completed_at,e.started_at,now()) >= now() - interval '24 hours') AS sync_failures_24h,
      (SELECT count(*) FROM voice_sessions WHERE organization_id=$1 AND status='active' AND ended_at IS NULL) AS active_voice_sessions,
      (SELECT count(*) FROM scheduled_jobs WHERE organization_id=$1 AND status='error') AS scheduled_errors,
      (SELECT count(*) FROM audit_events WHERE organization_id=$1 AND decision='denied' AND created_at >= now() - interval '24 hours') AS denied_audits_24h`, [rawId]);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      checks,
      metrics: Object.fromEntries(Object.entries(metrics.rows[0] ?? {}).map(([key, value]) => [key, Number(value)])),
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
