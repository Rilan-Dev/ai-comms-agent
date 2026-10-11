import { listScheduledJobs, PostgresAgentRepository } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SchedulesClient from "./schedules-client";

export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  if (!process.env.DATABASE_URL) return <main className="p-8"><h1 className="text-2xl font-semibold">Schedules unavailable</h1><p className="mt-2 text-sm text-muted-foreground">PostgreSQL is required for durable schedules.</p></main>;
  const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
  if (!context) redirect("/login?reason=not_provisioned");
  const organizationId = context.organizationId;
  const [schedules, agents] = await Promise.all([listScheduledJobs(organizationId), new PostgresAgentRepository().list(organizationId)]);
  return <SchedulesClient organizationId={organizationId} initialSchedules={schedules as never[]} agents={agents.map(a=>({id:a.id,name:a.name,status:a.status}))} />;
}
