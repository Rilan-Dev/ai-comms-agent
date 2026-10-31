import { PostgresAgentRepository } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";
import { VoiceWorkspace } from "./voice-workspace";

export const dynamic = "force-dynamic";

export default async function AIVoicePage() {
  if (!process.env.DATABASE_URL) return <Unavailable body="PostgreSQL is required for voice sessions." />;
  try {
    const context = await getAuthenticatedAppContext(
      new Request("http://localhost", { headers: await headers() }),
    );
    const organizationId = context?.organizationId;
    if (!organizationId) return <Unavailable body="Organization context is unavailable." />;
    const agents = await new PostgresAgentRepository().list(organizationId);
    if (!agents.length) return <Unavailable body="Create an agent before starting a voice session." actionHref="/agents/new" actionLabel="Create agent" />;
    return <VoiceWorkspace organizationId={organizationId} agents={agents.map((a) => ({ id: a.id, name: a.name, status: a.status }))} />;
  } catch {
    return <Unavailable body="The voice workspace could not load. Check PostgreSQL and retry." />;
  }
}

function Unavailable({ body, actionHref, actionLabel }: { body: string; actionHref?: string; actionLabel?: string }) {
  return <main className="mx-auto min-h-full max-w-3xl bg-background p-5 sm:p-7 lg:p-10"><div className="rounded-md border border-border bg-card p-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Realtime voice</p><h1 className="font-display text-2xl font-medium">Voice workspace unavailable<span className="text-tertiary">.</span></h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>{actionHref ? <a href={actionHref} className="mt-6 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85">{actionLabel}</a> : null}</div></main>;
}