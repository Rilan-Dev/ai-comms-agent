import { PostgresAgentRepository, getOrCreateChatConversation, listChatMessages } from "@ai-comms-agent/db";
import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  if (!process.env.DATABASE_URL) {
    return <Unavailable title="Chat needs PostgreSQL" body="Configure DATABASE_URL to persist conversations and connect Clara." />;
  }

  try {
    await ensureDevSeed();
    const organizationId = getDevOrgId();
    if (!organizationId) throw new Error("Organization context is unavailable.");

    const agents = await new PostgresAgentRepository().list(organizationId);
    const agent = agents[0];

    if (!agent) {
      return <Unavailable title="Create an agent first" body="Chat becomes available as soon as your organization has an agent. Open Agents to create one." actionHref="/agents/new" actionLabel="Create agent" />;
    }

    const conversation = await getOrCreateChatConversation(organizationId, agent.id);
    const messages = await listChatMessages(organizationId, conversation.id, 100);

    return (
      <ChatClient
        organizationId={organizationId}
        agents={agents.map((item) => ({ id: item.id, name: item.name, status: item.status }))}
        initialAgentId={agent.id}
        initialConversationId={conversation.id}
        initialMessages={messages as never[]}
      />
    );
  } catch (error) {
    console.error("[chat] load failed", error);
    return <Unavailable title="Chat unavailable" body="The conversation store could not be loaded. Check PostgreSQL and retry." error />;
  }
}

function Unavailable({ title, body, actionHref, actionLabel, error }: { title: string; body: string; actionHref?: string; actionLabel?: string; error?: boolean }) {
  return (
    <main className="mx-auto max-w-3xl p-5 sm:p-7 lg:p-10">
      <div className={"rounded-3xl border p-8 shadow-sm " + (error ? "border-destructive/20 bg-destructive/5" : "bg-background")}>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Clara chat</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p>
        {actionHref && actionLabel ? <a href={actionHref} className="mt-6 inline-flex rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background">{actionLabel}</a> : null}
      </div>
    </main>
  );
}
