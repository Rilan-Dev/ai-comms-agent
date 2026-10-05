import { PostgresAgentRepository } from "@ai-comms-agent/db";
import { AgentsClient } from "./agents-client";
import { ensureDevSeed, getDevOrgId, getDevUserId } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  if (!process.env.DATABASE_URL) {
    return <main className="mx-auto max-w-3xl p-6 lg:p-10"><div className="rounded-3xl border bg-background p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agents</p><h1 className="mt-2 text-2xl font-semibold">PostgreSQL is required</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Agent records are no longer backed by demo data. Configure DATABASE_URL for the application runtime, then reload this page.</p></div></main>;
  }
  try {
    await ensureDevSeed();
    const organizationId = getDevOrgId();
    const devUserId = getDevUserId();
    if (!organizationId || !devUserId) throw new Error("Development identity could not be resolved.");
    const agents = await new PostgresAgentRepository().list(organizationId);
    return <AgentsClient organizationId={organizationId} devUserId={devUserId} initialAgents={agents} />;
  } catch (error) {
    console.error("[agents] load failed", error);
    return <main className="mx-auto max-w-3xl p-6 lg:p-10"><div className="rounded-3xl border bg-background p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-destructive">Agents unavailable</p><h1 className="mt-2 text-2xl font-semibold">Could not load persisted agents</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">The application could not connect to PostgreSQL. Check the database connection and try again.</p></div></main>;
  }
}
