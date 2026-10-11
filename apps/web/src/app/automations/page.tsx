import { listAutomationRules, PostgresAgentRepository } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AutomationsClient from "./automations-client";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  if (!process.env.DATABASE_URL) return <main className="p-8"><h1 className="text-2xl font-semibold">Automations unavailable</h1><p className="mt-2 text-sm text-muted-foreground">PostgreSQL is required for persistent automation rules.</p></main>;
  const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
  if (!context) redirect("/login?reason=not_provisioned");
  const organizationId = context.organizationId;
  const [rules, agents] = await Promise.all([listAutomationRules(organizationId), new PostgresAgentRepository().list(organizationId)]);
  return <AutomationsClient organizationId={organizationId} initialRules={rules as never[]} agents={agents.map(a=>({id:a.id,name:a.name}))} />;
}
