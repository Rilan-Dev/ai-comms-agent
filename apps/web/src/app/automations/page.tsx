import { listAutomationRules } from "@ai-comms-agent/db";
import { PostgresAgentRepository } from "@ai-comms-agent/db";
import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import AutomationsClient from "./automations-client";

export default async function AutomationsPage() {
  if (!process.env.DATABASE_URL) return <main className="p-8"><h1 className="text-2xl font-semibold">Automations unavailable</h1><p className="mt-2 text-sm text-muted-foreground">PostgreSQL is required for persistent automation rules.</p></main>;
  await ensureDevSeed();
  const organizationId = getDevOrgId();
  if (!organizationId) return <main className="p-8"><h1 className="text-2xl font-semibold">Automations unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Organization context is unavailable.</p></main>;
  const [rules, agents] = await Promise.all([listAutomationRules(organizationId), new PostgresAgentRepository().list(organizationId)]);
  return <AutomationsClient organizationId={organizationId} initialRules={rules as never[]} agents={agents.map(a=>({id:a.id,name:a.name}))} />;
}
