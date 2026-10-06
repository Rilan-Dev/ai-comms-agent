import { PostgresAgentRepository } from "@ai-comms-agent/db";
import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import { VoiceWorkspace } from "./voice-workspace";

export const dynamic = "force-dynamic";

export default async function AIVoicePage() {
  if (!process.env.DATABASE_URL) return <Unavailable body="PostgreSQL is required for voice sessions." />;
  try {
    await ensureDevSeed();
    const organizationId = getDevOrgId();
    if (!organizationId) return <Unavailable body="Organization context is unavailable." />;
    const agents = await new PostgresAgentRepository().list(organizationId);
    if (!agents.length) return <Unavailable body="Create an agent before starting a voice session." actionHref="/agents/new" actionLabel="Create agent" />;
    return <VoiceWorkspace organizationId={organizationId} agents={agents.map((a) => ({ id: a.id, name: a.name, status: a.status }))} />;
  } catch {
    return <Unavailable body="The voice workspace could not load. Check PostgreSQL and retry." />;
  }
}

function Unavailable({ body, actionHref, actionLabel }: { body: string; actionHref?: string; actionLabel?: string }) {
  return <main className="mx-auto max-w-3xl p-6 lg:p-10"><div className="rounded-3xl border bg-background p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Clara realtime voice</p><h1 className="mt-2 text-2xl font-semibold">Voice workspace unavailable</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>{actionHref ? <a href={actionHref} className="mt-6 inline-flex rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background">{actionLabel}</a> : null}</div></main>;
}