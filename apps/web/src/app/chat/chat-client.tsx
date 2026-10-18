"use client";
import type React from "react";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Bot, Send, Sparkles, User } from "lucide-react";
import dynamic from "next/dynamic";

// Defer microphone and vendor transport code until the user requests voice.
const VoiceWorkspace = dynamic(
  () => import("../ai-voice/voice-workspace").then((module) => module.VoiceWorkspace),
  { ssr: false, loading: () => <p role="status" className="p-6 text-sm text-muted-foreground">Opening secure voice workspace…</p> },
);

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
  const [voiceOpen, setVoiceOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeAgent = useMemo(() => agents.find((agent) => agent.id === agentId) ?? agents[0], [agents, agentId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

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
          const lines = event.split("\n");
          const dataLine = lines.find((item) => item.startsWith("data: "));
          if (!dataLine) {
            if (event.includes("event: conversation") && dataLine) {
              const payload = JSON.parse(dataLine.slice(6)) as { conversationId?: string };
              if (payload.conversationId) setConversationId(payload.conversationId);
            }
            continue;
          }
          const payload = JSON.parse(dataLine.slice(6)) as { text?: string; conversationId?: string; message?: string };
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
      <header className="border-b bg-background/85 px-5 py-3 backdrop-blur sm:px-7">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Bot size={18} /></span>
            <div>
              <p className="text-sm font-semibold">{activeAgent?.name ?? "Clara"}</p>
              <p className="text-[11px] text-muted-foreground">{busy ? "Thinking…" : "Ready"}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setVoiceOpen(true)} disabled={busy || voiceOpen}
              aria-pressed={voiceOpen} aria-label={voiceOpen ? "Voice conversation open; use Back to chat to end safely" : "Open live realtime voice conversation"}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-secondary disabled:opacity-50">
              <AudioLines size={15} /> {voiceOpen ? "Voice session open" : "Live voice"}
            </button>
            <label className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5">
            <select aria-label="Choose agent" value={activeAgent?.id ?? ""} disabled={voiceOpen || busy} onChange={(e) => void switchAgent(e.target.value)} className="max-w-36 bg-transparent text-xs font-medium outline-none sm:max-w-48">
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
            </label>
          </div>
        </div>
      </header>

      {voiceOpen ? (
        <VoiceWorkspace organizationId={organizationId} agents={agents} initialAgentId={agentId}
          embedded onReturnToChat={() => setVoiceOpen(false)} />
      ) : (
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        <div role="log" aria-live="polite" className="min-w-0 flex-1 space-y-6 overflow-y-auto py-6">
          {messages.length === 0 ? (
            <div className="grid min-h-[50vh] place-items-center text-center">
              <div className="max-w-md">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkles size={24} /></div>
                <h2 className="mt-4 text-lg font-semibold">Ask Clara anything</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">Summarize your inbox, find important emails, or ask about recent messages.</p>
                <div className="mt-5 grid gap-2">
                  {["What needs my attention today?", "Summarize my recent emails", "Show emails from the last hour"].map((prompt) =>
                    <button key={prompt} onClick={() => setDraft(prompt)} className="rounded-lg border bg-card px-3.5 py-2.5 text-left text-sm transition hover:border-primary/30 hover:bg-accent/5">{prompt}</button>
                  )}
                </div>
              </div>
            </div>
          ) : messages.map((message) => (
            <MessageBubble key={message.id} role={message.role} content={message.content} />
          ))}
          {busy && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-0 bg-background pb-4 pt-2">
          <div className="rounded-2xl border border-border bg-card shadow-sm focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
            <textarea
              aria-label="Message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
              placeholder="Send a message…"
              rows={1}
              className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
              style={{ height: "auto" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 160) + "px";
              }}
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <button type="button" onClick={() => setVoiceOpen(true)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-primary"
                aria-label="Start a realtime AI voice conversation"><AudioLines size={13} /> Live voice conversation</button>
              <button type="button" disabled={busy || !draft.trim()} onClick={() => void sendMessage()} className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground">
                <Send size={15} />
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Clara can make mistakes. Verify important information.</p>
        </div>
      </section>
      )}
    </main>
  );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  if (role === "system") {
    return (
      <div className="flex justify-center">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2 text-xs text-destructive">{content}</div>
      </div>
    );
  }

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[80%] items-start gap-2.5">
          <div className="rounded-2xl rounded-br-sm bg-foreground px-4 py-2.5 text-sm text-background">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><User size={15} /></span>
        </div>
      </div>
    );
  }

  // Assistant (Clara) message
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Bot size={15} /></span>
        <div className="flex-1 text-sm leading-7">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Bot size={15} /></span>
        <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-card border px-4 py-3">
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Lightweight Markdown renderer — handles the most common markdown features
 * found in LLM responses: bold, italic, inline code, code blocks, headers,
 * bullet lists, numbered lists, links, and paragraphs. No external deps.
 */
function MarkdownRenderer({ content }: { content: string }) {
  const elements = parseMarkdown(content);
  return <div className="space-y-2">{elements}</div>;
}

function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={key++} className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-xs">
          <code className="font-mono">{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headerMatch) {
      const level = (headerMatch![1] ?? "").length;
      const content = renderInline(headerMatch![2] ?? "");
      const sizes = ["text-lg font-bold", "text-base font-bold", "text-sm font-bold", "text-sm font-semibold"];
      elements.push(<p key={key++} className={sizes[level - 1]}>{content}</p>);
      i++;
      continue;
    }

    // Bullet list
    if (line.match(/^\s*[-•]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && (lines[i] ?? "").match(/^\s*[-•]\s+/)) {
        items.push((lines[i] ?? "").replace(/^\s*[-•]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={key++} className="list-disc space-y-1 pl-5">
          {items.map((item, idx) => <li key={idx}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\s*\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && (lines[i] ?? "").match(/^\s*\d+\.\s+/)) {
        items.push((lines[i] ?? "").replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="list-decimal space-y-1 pl-5">
          {items.map((item, idx) => <li key={idx}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() !== "" && !(lines[i] ?? "").trim().startsWith("```") && !(lines[i] ?? "").match(/^(#{1,4})\s+/) && !(lines[i] ?? "").match(/^\s*[-•]\s+/) && !(lines[i] ?? "").match(/^\s*\d+\.\s+/)) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(<p key={key++} className="leading-7">{renderInline(paraLines!.join("\n"))}</p>);
    }
  }

  return elements;
}

/** Render inline markdown: bold, italic, inline code, links */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code `code`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Link [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    // Italic *text* (after bold, to avoid conflicting with **)
    const italicMatch = remaining.match(/\*([^*]+?)\*/);

    // Find the earliest match
    const matches = [
      { match: boldMatch, type: "bold" },
      { match: codeMatch, type: "code" },
      { match: linkMatch, type: "link" },
      { match: italicMatch, type: "italic" },
    ].filter(m => m.match);

    if (matches.length === 0) {
      // No more matches — push remaining text
      if (remaining) parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    // Sort by position
    matches.sort((a, b) => (a.match!.index ?? 0) - (b.match!.index ?? 0));
    const earliest = matches[0]!;
    const match = earliest!.match!;
    const before = remaining.slice(0, match!.index);
    if (before) parts.push(<span key={key++}>{before}</span>);

    if (earliest!.type === "bold") {
      parts.push(<strong key={key++} className="font-semibold">{match![1]}</strong>);
    } else if (earliest!.type === "code") {
      parts.push(<code key={key++} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{match![1]}</code>);
    } else if (earliest!.type === "link") {
      parts.push(<a key={key++} href={match![2]} target="_blank" rel="noreferrer" className="text-primary underline hover:opacity-80">{match![1]}</a>);
    } else if (earliest!.type === "italic") {
      parts.push(<em key={key++} className="italic">{match![1]}</em>);
    }

    remaining = remaining.slice((match!.index ?? 0) + match![0].length);
  }

  return parts;
}
