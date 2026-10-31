import { PostgresAgentRepository } from "@ai-comms-agent/db";
import { AgentDetailClient } from "./agent-detail-client";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return <main className="mx-auto max-w-3xl p-6 lg:p-10"><div className="rounded-md border border-border bg-card p-8 shadow-sm"><h1 className="font-display text-2xl font-medium">PostgreSQL is required</h1><p className="mt-3 text-sm text-muted-foreground">Persisted agent details require DATABASE_URL.</p></div></main>;
  try {
    const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
    if (!context) throw new Error("Authenticated application identity could not be resolved.");
    const organizationId=context.organizationId;
    const { id }=await params; const repo=new PostgresAgentRepository(); const agent=await repo.get(organizationId,id);
    if(!agent) return <main className="mx-auto max-w-3xl p-6 lg:p-10"><div className="rounded-md border border-border bg-card p-8"><h1 className="font-display text-2xl font-medium">Agent not found</h1><p className="mt-2 text-sm text-muted-foreground">The requested agent does not exist in this organization.</p></div></main>;
    const [versions,policy,channels]=await Promise.all([repo.versions(organizationId,id),repo.policy(organizationId,id),Promise.all([repo.emailBindings(organizationId,id),repo.whatsappBinding(organizationId,id)])]);
    return <AgentDetailClient key={`${organizationId}:${id}`} organizationId={organizationId} initialAgent={agent} initialVersions={versions} initialPolicy={policy} initialEmailBindings={channels[0]} initialWhatsAppBinding={channels[1]} configurationRevisionsEnabled={process.env.AGENT_CONFIGURATION_REVISIONS_ENABLED==='true'}/>;
  } catch (error) {
    console.error("[agent-detail] load failed",error);
    return <main className="mx-auto max-w-3xl p-6 lg:p-10"><div className="rounded-md border border-border bg-card p-8"><h1 className="font-display text-2xl font-medium">Agent unavailable</h1><p className="mt-2 text-sm text-muted-foreground">The agent could not be loaded from PostgreSQL.</p></div></main>;
  }
}
