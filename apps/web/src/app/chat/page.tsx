import { PostgresAgentRepository, getChatConversation, getOrCreateChatConversation, listChatConversations, listChatMessages } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";
import { ChatClient } from "./chat-client";
import { briefingsEnabled } from "@/lib/briefings/config";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{agentId?:string;conversationId?:string}> }) {
  if (!process.env.DATABASE_URL) {
    return <Unavailable title="Chat needs PostgreSQL" body="Configure DATABASE_URL to persist conversations and connect Clara." />;
  }

  try {
    const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
    const organizationId = context?.organizationId;
    if (!organizationId) throw new Error("Organization context is unavailable.");

    const agents = await new PostgresAgentRepository().list(organizationId);
    const params = await searchParams;
    const requestedAgentId = params.agentId;
    // Both the agent and an optional chat deep link must stay inside the org.
    const agent = agents.find(item => item.id === requestedAgentId) ?? agents[0];

    if (!agent) {
      return <Unavailable title="Create an agent first" body="Chat becomes available as soon as your organization has an agent. Open Agents to create one." actionHref="/agents/new" actionLabel="Create agent" />;
    }

    const conversation = params.conversationId
      ? await getChatConversation(organizationId, params.conversationId, agent.id)
      : await getOrCreateChatConversation(organizationId, agent.id);
    if (!conversation) {
      return <Unavailable title="Chat not found" body="This conversation is not available in the selected organization and agent." />;
    }
    const [messages, conversations] = await Promise.all([
      listChatMessages(organizationId, conversation.id, 100),
      listChatConversations(organizationId, agent.id, 40),
    ]);

    return (
      <ChatClient
        organizationId={organizationId}
        agents={agents.map((item) => ({ id: item.id, name: item.name, status: item.status }))}
        initialAgentId={agent.id}
        initialConversationId={conversation.id}
        initialMessages={messages as never[]}
        initialConversations={conversations}
        catchUpEnabled={briefingsEnabled()}
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
