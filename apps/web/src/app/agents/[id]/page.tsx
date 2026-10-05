import { PostgresAgentRepository } from "@ai-comms-agent/db";
import { AgentDetailClient } from "./agent-detail-client";
import { ensureDevSeed, getDevOrgId, getDevUserId } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return <main className="mx-auto max-w-3xl p-6 lg:p-10"><div className="rounded-3xl border bg-background p-8 shadow-sm"><h1 className="text-2xl font-semibold">PostgreSQL is required</h1><p className="mt-3 text-sm text-muted-foreground">Persisted agent details require DATABASE_URL.</p></div></main>;
  try {
    await ensureDevSeed();
    const organizationId=getDevOrgId(); const devUserId=getDevUserId(); if(!organizationId || !devUserId) throw new Error("Development identity could not be resolved.");
    const { id }=await params; const repo=new PostgresAgentRepository(); const agent=await repo.get(organizationId,id);
    if(!agent) return <main className="mx-auto max-w-3xl p-6 lg:p-10"><div className="rounded-3xl border p-8"><h1 className="text-2xl font-semibold">Agent not found</h1><p className="mt-2 text-sm text-muted-foreground">The requested agent does not exist in this organization.</p></div></main>;
    const [versions,policy,channels]=await Promise.all([repo.versions(organizationId,id),repo.policy(organizationId,id),Promise.all([repo.emailBindings(organizationId,id),repo.whatsappBinding(organizationId,id)])]);
    return <AgentDetailClient organizationId={organizationId} devUserId={devUserId} initialAgent={agent} initialVersions={versions} initialPolicy={policy} initialEmailBindings={channels[0]} initialWhatsAppBinding={channels[1]}/>;
  } catch (error) {
    console.error("[agent-detail] load failed",error);
    return <main className="mx-auto max-w-3xl p-6 lg:p-10"><div className="rounded-3xl border p-8"><h1 className="text-2xl font-semibold">Agent unavailable</h1><p className="mt-2 text-sm text-muted-foreground">The agent could not be loaded from PostgreSQL.</p></div></main>;
  }
}
