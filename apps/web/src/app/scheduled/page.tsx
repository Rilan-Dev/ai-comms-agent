import { listAutomationRules, listScheduledJobs, listBusinessAssignees, PostgresAgentRepository } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ScheduledClient from "./scheduled-client";

export const dynamic = "force-dynamic";

export default async function ScheduledPage() {
  if (!process.env.DATABASE_URL) return <main className="p-8"><h1 className="text-2xl font-semibold">Scheduled AI agent unavailable</h1><p className="mt-2 text-sm text-muted-foreground">PostgreSQL is required for durable scheduled AI agent tasks.</p></main>;
  const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
  if (!context) redirect("/login?reason=not_provisioned");
  const organizationId = context.organizationId;
  const [schedules, rules, agents, assignees] = await Promise.all([
    listScheduledJobs(organizationId),
    listAutomationRules(organizationId),
    new PostgresAgentRepository().list(organizationId),
    listBusinessAssignees(organizationId),
  ]);
  return <ScheduledClient
    organizationId={organizationId}
    initialSchedules={schedules as never[]}
    initialRules={rules as never[]}
    agents={agents.map(a => ({ id: a.id, name: a.name, status: a.status }))}
    assignees={assignees}
  />;
}
