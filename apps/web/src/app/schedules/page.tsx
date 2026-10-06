import { listScheduledJobs } from "@ai-comms-agent/db";
import { PostgresAgentRepository } from "@ai-comms-agent/db";
import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import SchedulesClient from "./schedules-client";

export default async function SchedulesPage() {
  if (!process.env.DATABASE_URL) return <main className="p-8"><h1 className="text-2xl font-semibold">Schedules unavailable</h1><p className="mt-2 text-sm text-muted-foreground">PostgreSQL is required for durable schedules.</p></main>;
  await ensureDevSeed();
  const organizationId = getDevOrgId();
  if (!organizationId) return <main className="p-8"><h1 className="text-2xl font-semibold">Schedules unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Organization context is unavailable.</p></main>;
  const [schedules, agents] = await Promise.all([listScheduledJobs(organizationId), new PostgresAgentRepository().list(organizationId)]);
  return <SchedulesClient organizationId={organizationId} initialSchedules={schedules as never[]} agents={agents.map(a=>({id:a.id,name:a.name,status:a.status}))} />;
}
