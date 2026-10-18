import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PostgresAgentRepository, listGrantedBriefingMailboxes } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { briefingsEnabled } from "@/lib/briefings/config";
import { CatchUpClient } from "./catch-up-client";

export const dynamic = "force-dynamic";

export default async function CatchUpPage() {
  // C4 source-linked preview is intentionally unavailable unless the server
  // explicitly enables catch-up; C3 background AI generation isn't active yet.
  if (!briefingsEnabled()) notFound();
  if (!process.env.DATABASE_URL) {
    return <main className="mx-auto max-w-3xl p-8" role="status">Catch-up requires a connected database.</main>;
  }
  try {
    const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
    if (!context?.organizationId || !context.user?.id) {
      return <main className="mx-auto max-w-3xl p-8" role="status">Sign in and select an organization to view catch-up.</main>;
    }
    const agents = await new PostgresAgentRepository().list(context.organizationId);
    const choices: Array<{ agentId: string; name: string; mailboxes: Array<{ id: string; emailAddress: string }> }> = [];
    for (const agent of agents) {
      let mailboxes: Array<{ id: string; emailAddress: string }> = [];
      try {
        mailboxes = await listGrantedBriefingMailboxes({
          organizationId: context.organizationId, userId: context.user.id, agentId: agent.id,
        });
      } catch {
        // No grant and denied agents are indistinguishable in this UI.
      }
      choices.push({ agentId: agent.id, name: agent.name, mailboxes });
    }
    return <CatchUpClient organizationId={context.organizationId} agents={choices} />;
  } catch {
    return <main className="mx-auto max-w-3xl p-8" role="alert">Catch-up could not be loaded. Try again later.</main>;
  }
}
