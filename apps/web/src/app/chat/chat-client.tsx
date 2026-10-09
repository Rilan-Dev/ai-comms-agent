"use client";

import { useMemo, useState } from "react";
import { AudioLines, Send, Sparkles } from "lucide-react";

type Agent = { id: string; name: string; status: string };
type Message = { id: string; conversationId: string; role: string; content: string; createdAt: string };

export function ChatClient({
  organizationId,
  agents,
  initialAgentId,
  initialConversationId,
  initialMessages,
}: {
  organizationId: string;
  agents: Agent[];
  initialAgentId: string;
  initialConversationId: string;
  initialMessages: Message[];
}) {
  const [agentId, setAgentId] = useState(initialAgentId);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const activeAgent = useMemo(() => agents.find((agent) => agent.id === agentId) ?? agents[0], [agents, agentId]);

  async function switchAgent(nextAgentId: string) {
    if (busy || nextAgentId === agentId) return;
    setAgentId(nextAgentId);
    try {
      const response = await fetch(`/api/chat/conversation?organizationId=${encodeURIComponent(organizationId)}&agentId=${encodeURIComponent(nextAgentId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the selected agent conversation");
      const payload = await response.json() as { conversation: { id: string }; messages: Message[] };
      setConversationId(payload.conversation.id);
      setMessages(payload.messages);
    } catch (error) {
      setMessages([{ id: "switch-error-" + Date.now(), conversationId, role: "system", content: error instanceof Error ? error.message : "Could not switch agent", createdAt: new Date().toISOString() }]);
    }
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || busy || !activeAgent) return;
    setDraft("");
    setBusy(true);

    const optimisticId = "local-" + Date.now();
    setMessages((current) => [...current, { id: optimisticId, conversationId, role: "user", content, createdAt: new Date().toISOString() }]);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ organizationId, agentId: activeAgent.id, conversationId, message: content }),
      });
      if (!response.ok || !response.body) throw new Error((await response.text()) || "Chat request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantId = "local-assistant-" + Date.now();
      let assistant = "";
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.split("\n").find((item) => item.startsWith("data: "));
          if (!line) {
            const conversationLine = event.split("\n").find((item) => item.startsWith("data: "));
            if (event.startsWith("event: conversation") && conversationLine) {
              const payload = JSON.parse(conversationLine.slice(6)) as { conversationId?: string };
              if (payload.conversationId) setConversationId(payload.conversationId);
            }
            continue;
          }
          const payload = JSON.parse(line.slice(6)) as { text?: string; conversationId?: string; message?: string };
          if (payload.conversationId) setConversationId(payload.conversationId);
          if (payload.text) {
            assistant += payload.text;
            setMessages((current) => {
              const existing = current.findIndex((message) => message.id === assistantId);
              const next = { id: assistantId, conversationId, role: "assistant", content: assistant, createdAt: new Date().toISOString() };
              if (existing === -1) return [...current, next];
              return current.map((message, index) => index === existing ? next : message);
            });
          }
          if (payload.message) throw new Error(payload.message);
        }
      }
    } catch (error) {
      setMessages((current) => [...current, { id: "error-" + Date.now(), conversationId, role: "system", content: error instanceof Error ? error.message : "Chat failed", createdAt: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-72px)] min-w-0 flex-col bg-background">
      <header className="border-b bg-background/85 px-5 py-4 backdrop-blur sm:px-7">
        <div className="mx-auto flex max-w-[1180px] items-start justify-between gap-3 sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Clara workspace</p>
            <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">Chat with your agent<span className="text-tertiary">.</span></h1>
            <p className="mt-1 text-sm text-muted-foreground">Grounded through Clara. Actions remain behind the host authorization boundary.</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 rounded-md border bg-background px-2 py-2 sm:px-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">Agent</span>
            <select aria-label="Choose agent for chat" value={activeAgent?.id ?? ""} onChange={(event) => void switchAgent(event.target.value)} className="min-w-0 max-w-[38vw] bg-transparent text-xs font-semibold outline-none sm:max-w-none sm:text-sm">
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 py-5 sm:px-7">
        <div role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions" className="min-w-0 flex-1 space-y-4 overflow-y-auto pb-6">
          {messages.length === 0 ? (
            <div className="grid min-h-[45vh] place-items-center text-center">
              <div className="max-w-md">
                <div className="mx-auto grid size-14 place-items-center rounded-md bg-accent text-accent-foreground"><Sparkles aria-hidden="true" size={28} /></div>
                <h2 className="mt-5 text-xl font-semibold">What should Clara help with?</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask for an inbox summary, important messages, action items, or anything your connected communication agent is allowed to handle.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["What needs my attention today?", "Summarize the last 24 hours", "Show important emails"].map((prompt) => <button key={prompt} onClick={() => setDraft(prompt)} className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition hover:-translate-y-0.5 hover:bg-muted">{prompt}</button>)}
                </div>
              </div>
            </div>
          ) : messages.map((message) => (
            <div key={message.id} className={"flex " + (message.role === "user" ? "justify-end" : "justify-start")}>
              <div className={"max-w-[min(760px,90%)] rounded-md px-4 py-3 text-sm leading-6 " + (message.role === "user" ? "rounded-br-md bg-foreground text-background" : message.role === "system" ? "border border-destructive/20 bg-destructive/5 text-destructive" : "rounded-bl-md border bg-background")}>
                {message.role === "assistant" ? <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-primary">Clara</p> : null}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {busy ? <div role="status" aria-live="polite" className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Clara is thinking…</div> : null}
        </div>

        <div className="sticky bottom-0 rounded-md border border-border bg-card/95 p-2 backdrop-blur">
          <div className="flex items-end gap-2">
            <textarea aria-label="Message to Clara" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Ask Clara about your communications…" rows={2} className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <button type="button" disabled={busy || !draft.trim()} onClick={() => void sendMessage()} className="rounded-md bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"><Send size={14} className="mr-2 inline" />Send</button>
          </div>
          <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[11px] text-muted-foreground">
            <span>Enter to send · Shift+Enter for a new line</span>
            <a href="/ai-voice" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"><AudioLines size={13} /> Open voice workspace →</a>
          </div>
        </div>
      </section>
    </main>
  );
}
