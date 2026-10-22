"use client";
import type React from "react";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Bot, Send, Sparkles, User } from "lucide-react";
import dynamic from "next/dynamic";
import { readSseEvents } from "@/lib/streaming/sse";
import { agentActivityLabel, safeActivityPhase, type AgentActivityPhase } from "@/lib/ai/activity-progress";
import { EMAIL_PERMISSION_PRESETS, EMAIL_PERMISSION_LABELS, REGISTERED_EMAIL_POLICY_NAMES, emailPermissionPresetSelection, summarizeEmailPermissionChanges } from "@/lib/agents/email-permission-presets";
import { parseTestEmailComposeRequest } from "@/lib/mail/test-email-compose-intent";
import type { AgentPolicy } from "@ai-comms-agent/shared";

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
  catchUpEnabled = false,
}: {
  organizationId: string;
  agents: Agent[];
  initialAgentId: string;
  initialConversationId: string;
  initialMessages: Message[];
  catchUpEnabled?: boolean;
}) {
  const [agentId, setAgentId] = useState(initialAgentId);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [mailComposerOpen, setMailComposerOpen] = useState(false);
  const [composeMailboxes, setComposeMailboxes] = useState<Array<{id:string;address:string}>>([]);
  const [composeAccount, setComposeAccount] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("Test Email");
  const [composeBody, setComposeBody] = useState("Hi,\n\nThis is a test email from my workspace.\n\nPlease let me know if you receive this correctly.\n\nBest regards");
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [composeActionId, setComposeActionId] = useState<string | null>(null);
  const [composeCanDraft, setComposeCanDraft] = useState(false);
  const [composeCanApprove, setComposeCanApprove] = useState(false);
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeNotice, setComposeNotice] = useState("");
  const [mailPermissionOpen, setMailPermissionOpen] = useState(false);
  const [mailPolicy, setMailPolicy] = useState<AgentPolicy | null>(null);
  const [mailToolSelection, setMailToolSelection] = useState<string[]>([]);
  const [mailPermissionBusy, setMailPermissionBusy] = useState(false);
  const [mailPermissionNotice, setMailPermissionNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [responseStarted, setResponseStarted] = useState(false);
  const [activity, setActivity] = useState("");
  const [activitySteps, setActivitySteps] = useState<AgentActivityPhase[]>([]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const voiceWasOpen = useRef(false);
  const [agentSwitchBusy, setAgentSwitchBusy] = useState(false);
  const [agentSwitchNotice, setAgentSwitchNotice] = useState("");
  // Keep agent selection and server-scoped message history atomic.
  const agentSwitchInFlightRef = useRef(false);
  const agentContextEpochRef = useRef(0);
  // A returned draft/action ID may only be attached to the same review revision.
  const composeRevisionRef = useRef(0);
  const composeInFlightRef = useRef(false);

  function invalidateComposeReview() {
    composeRevisionRef.current += 1;
    setComposeDraftId(null);
    setComposeActionId(null);
    setComposeNotice("");
  }

  // After closing the embedded voice panel, return keyboard focus to the
  // original text composer, preserving any unsent draft.
  useEffect(() => {
    if (voiceOpen) {
      voiceWasOpen.current = true;
    } else if (voiceWasOpen.current) {
      voiceWasOpen.current = false;
      composerRef.current?.focus();
    }
  }, [voiceOpen]);

  const activeAgent = useMemo(() => agents.find((agent) => agent.id === agentId) ?? agents[0], [agents, agentId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  async function switchAgent(nextAgentId: string) {
    if (busy || voiceOpen || mailPermissionBusy || composeInFlightRef.current
        || agentSwitchInFlightRef.current || nextAgentId === agentId) return;
    if (!agents.some(agent => agent.id === nextAgentId)) return;
    agentSwitchInFlightRef.current = true;
    setAgentSwitchBusy(true);
    setAgentSwitchNotice("");
    const epoch = ++agentContextEpochRef.current;
    try {
      const response = await fetch("/api/chat/conversation?organizationId=" + encodeURIComponent(organizationId)
        + "&agentId=" + encodeURIComponent(nextAgentId), { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the selected agent conversation.");
      const payload = await response.json() as { conversation?: { id: string }; messages?: Message[] };
      if (!payload.conversation?.id || !Array.isArray(payload.messages)
          || payload.messages.some(message => message.conversationId !== payload.conversation?.id)) {
        throw new Error("The selected agent's conversation response was invalid.");
      }
      if (epoch !== agentContextEpochRef.current) return;
      // Do not show a new agent with an old agent's history, even momentarily.
      setAgentId(nextAgentId);
      setConversationId(payload.conversation.id);
      setMessages(payload.messages);
      composeRevisionRef.current += 1;
      setMailComposerOpen(false);
      setComposeMailboxes([]);
      setComposeAccount("");
      setComposeDraftId(null);
      setComposeActionId(null);
      setComposeCanDraft(false);
      setComposeCanApprove(false);
      setComposeNotice("");
      setMailPermissionOpen(false);
      setMailPolicy(null);
      setMailToolSelection([]);
      setMailPermissionNotice("");
      setActivitySteps([]);
      setResponseStarted(false);
    } catch (error) {
      // Failed navigation must retain the original valid agent + conversation.
      if (epoch === agentContextEpochRef.current) {
        setAgentSwitchNotice(error instanceof Error ? error.message : "Could not switch agent.");
      }
    } finally {
      if (epoch === agentContextEpochRef.current) {
        agentSwitchInFlightRef.current = false;
        setAgentSwitchBusy(false);
      }
    }
  }

  async function returnFromVoice() {
    const epoch = agentContextEpochRef.current;
    setVoiceOpen(false);
    // Reload the same server-scoped agent conversation. Keep the unsent Chat
    // draft intact; only host-confirmed transcript turns appear after reload.
    try {
      const params = new URLSearchParams({ organizationId, agentId });
      const response = await fetch(`/api/chat/conversation?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not refresh the conversation.");
      const data = await response.json() as { conversation?: { id: string }; messages?: Message[] };
      if (epoch !== agentContextEpochRef.current) return;
      if (data.conversation && Array.isArray(data.messages)
          && data.messages.every(message => message.conversationId === data.conversation?.id)) {
        setConversationId(data.conversation.id);
        setMessages(data.messages);
      }
    } catch {
      if (epoch !== agentContextEpochRef.current) return;
      setMessages(current => [...current, {
        id: `voice-history-error-${Date.now()}`, conversationId, role: "system",
        content: "Voice history could not be refreshed. Your unsent message is preserved; retry the chat page to load saved turns.",
        createdAt: new Date().toISOString(),
      }]);
    }
  }

  async function openMailComposer(recipient = "") {
    if (!activeAgent) return;
    setComposeBusy(true);
    setComposeNotice("");
    setComposeDraftId(null);
    setComposeActionId(null);
    try {
      const response = await fetch("/api/chat/mail-compose?organizationId=" + encodeURIComponent(organizationId) + "&agentId=" + encodeURIComponent(activeAgent.id), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "The bound mailbox could not be loaded.");
      setComposeMailboxes(data.mailboxes ?? []);
      setComposeAccount(data.mailboxes?.[0]?.id ?? "");
      setComposeCanDraft(data.canDraft === true);
      setComposeCanApprove(data.canRequestApproval === true);
      if (recipient) setComposeTo(recipient);
      setMailComposerOpen(true);
    } catch (error) {
      setComposeNotice(error instanceof Error ? error.message : "Draft setup failed.");
    } finally { setComposeBusy(false); }
  }
  async function submitMailCompose(action: "draft"|"request_approval") {
    if (!activeAgent || !composeAccount || composeBusy) return;
    if (action === "request_approval") {
      if (!composeDraftId) return;
      if (!window.confirm(`Request approval to send the saved draft to ${composeTo} from ${composeMailboxes.find(mail => mail.id === composeAccount)?.address ?? "the selected mailbox"}? No email will be sent until a person approves.`)) return;
    }
    setComposeBusy(true);
    setComposeNotice("");
    try {
      const response = await fetch("/api/chat/mail-compose", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId, agentId: activeAgent.id, conversationId, accountId: composeAccount,
          action, to: composeTo, subject: composeSubject, bodyText: composeBody, draftId: composeDraftId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "The email tool was denied. Check your saved permissions.");
      if (action === "draft" && typeof data.draftId === "string") setComposeDraftId(data.draftId);
      if (action === "request_approval" && data.status === "pending_approval" && typeof data.actionId === "string") setComposeActionId(data.actionId);
      setComposeNotice(data.message ?? "The authorized tool completed.");
    } catch (error) { setComposeNotice(error instanceof Error ? error.message : "The operation failed."); }
    finally { setComposeBusy(false); }
  }

  async function reloadMailPermissions() {
    if (!activeAgent || mailPermissionBusy) return;
    if (mailPolicy) {
      const changes = summarizeEmailPermissionChanges(mailPolicy.allowedTools, mailToolSelection);
      if ((changes.added.length || changes.removed.length)
          && !window.confirm("Discard unsaved permission selections and reload the saved policy?")) return;
    }
    setMailPermissionBusy(true);
    setMailPermissionNotice("");
    try {
      const response = await fetch("/api/agents/" + encodeURIComponent(activeAgent.id)
        + "/policy?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Administrator access is required to change agent permissions.");
      setMailPolicy(data.policy);
      setMailToolSelection(data.policy.allowedTools);
      setMailPermissionOpen(true);
    } catch (error) {
      setMailPermissionNotice(error instanceof Error ? error.message : "Permissions are unavailable.");
    } finally {
      setMailPermissionBusy(false);
    }
  }
  async function openMailPermissions() {
    if (mailPermissionOpen) { setMailPermissionOpen(false); return; }
    await reloadMailPermissions();
  }
  async function saveMailPermissions() {
    if (!activeAgent || !mailPolicy || mailPermissionBusy || busy || voiceOpen) return;
    const { added, removed, confirmation } =
      summarizeEmailPermissionChanges(mailPolicy.allowedTools, mailToolSelection);
    if (!added.length && !removed.length) { setMailPermissionNotice("No changes to save."); return; }
    if (!window.confirm(confirmation)) return;
    setMailPermissionBusy(true);
    setMailPermissionNotice("");
    try {
      const response = await fetch("/api/agents/" + encodeURIComponent(activeAgent.id) + "/policy", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId, securityPolicy: mailPolicy.securityPolicy, rateLimits: mailPolicy.rateLimits,
          allowedTools: mailToolSelection, allowedSenders: mailPolicy.allowedSenders,
          blockedSenders: mailPolicy.blockedSenders,
          expectedPolicy: {
            securityPolicy: mailPolicy.securityPolicy, rateLimits: mailPolicy.rateLimits,
            allowedTools: mailPolicy.allowedTools, allowedSenders: mailPolicy.allowedSenders,
            blockedSenders: mailPolicy.blockedSenders,
          },
        }),
      });
      const data = await response.json();
      if (response.status === 409 && data.error === "policy_changed") {
        setMailPermissionNotice("Permissions changed in another session. Your choices were NOT saved. Reload current permissions, review the changes, and confirm again.");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Policy could not be saved; administrator access is required.");
      setMailPolicy(data.policy);
      setMailToolSelection(data.policy.allowedTools);
      setMailPermissionNotice("Permissions saved for future chat and voice turns. No email was sent.");
    } catch (error) {
      setMailPermissionNotice(error instanceof Error ? error.message : "Permissions could not be saved.");
    } finally { setMailPermissionBusy(false); }
  }

  async function sendMessage() {
    const content = draft.trim();
    // Recognize an explicit, bounded test-email request as a LOCAL COMPOSE
    // preview. Never interpret prose as permission to send or approve.
    const testEmailRequest = parseTestEmailComposeRequest(content);
    if (testEmailRequest && !busy) {
      setDraft("");
      void openMailComposer(testEmailRequest);
      return;
    }
    if (!content || busy || !activeAgent) return;
    setDraft("");
    setBusy(true);
    setResponseStarted(false);
    setActivity("Preparing response…");
    setActivitySteps(["preparing"]);

    const optimisticId = "local-" + Date.now();
    setMessages((current) => [...current, { id: optimisticId, conversationId, role: "user", content, createdAt: new Date().toISOString() }]);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ organizationId, agentId: activeAgent.id, conversationId, message: content }),
      });
      if (!response.ok || !response.body) throw new Error((await response.text()) || "Chat request failed");

      const assistantId = "local-assistant-" + Date.now();
      let assistant = "";
      let completed = false;
      for await (const event of readSseEvents(response.body)) {
        const payload = JSON.parse(event.data) as {
          text?: string; conversationId?: string; message?: string; phase?: string;
        };
        if (event.event === "error") throw new Error(payload.message || "AI generation failed.");
        if (payload.conversationId) setConversationId(payload.conversationId);
        if (event.event === "progress") {
          const phase = safeActivityPhase(payload.phase);
          if (phase) {
            setActivity(agentActivityLabel(phase));
            setActivitySteps((steps) => steps.at(-1) === phase ? steps : [...steps, phase].slice(-10));
          }
          continue;
        }
        if (event.event === "status") {
          const phase: AgentActivityPhase = payload.phase === "tools" ? "checking_permissions" : "generating";
          setActivity(agentActivityLabel(phase));
          setActivitySteps((steps) => steps.at(-1) === phase ? steps : [...steps, phase].slice(-10));
          continue;
        }
        if (event.event === "done") {
          completed = true;
          setActivitySteps((steps) => [...steps, "completed" as AgentActivityPhase].slice(-10));
          break;
        }
        if (payload.text) {
          assistant += payload.text;
          setResponseStarted(true);
          setActivity("Streaming response…");
          setMessages((current) => {
            const next: Message = {
              id: assistantId, conversationId, role: "assistant",
              content: assistant, createdAt: new Date().toISOString(),
            };
            return current.some((message) => message.id === assistantId)
              ? current.map((message) => message.id === assistantId ? next : message)
              : [...current, next];
          });
        }
      }
      if (!completed) throw new Error("The AI response stopped before completion. The partial answer above may be incomplete.");
    } catch (error) {
      setMessages((current) => [...current, { id: "error-" + Date.now(), conversationId, role: "system", content: error instanceof Error ? error.message : "Chat failed", createdAt: new Date().toISOString() }]);
    } finally {
      setBusy(false);
      setResponseStarted(false);
      setActivity("");
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-72px)] min-w-0 flex-col bg-background">
      <header className="border-b bg-background/85 px-4 py-3 backdrop-blur sm:px-7">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Bot size={18} /></span>
            <div>
              <p className="text-sm font-semibold">{activeAgent?.name ?? "Clara"}</p>
              <p className="text-[11px] text-muted-foreground">{busy ? (activity || "Thinking…") : "Ready"}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => { if (mailComposerOpen) setMailComposerOpen(false); else void openMailComposer(); }} disabled={busy || composeBusy || voiceOpen} className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50" aria-expanded={mailComposerOpen}>Compose email</button>
            <button type="button" onClick={() => void openMailPermissions()} disabled={busy || mailPermissionBusy || voiceOpen} className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50" aria-expanded={mailPermissionOpen}>Mail permissions</button>
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

      {composeNotice && <p role="status" className="mx-auto w-full max-w-3xl px-4 py-2 text-xs text-muted-foreground">{composeNotice}</p>}
      {mailComposerOpen && !voiceOpen && (
        <section aria-label="Compose an email using this agent" className="mx-auto w-full max-w-3xl border-b px-4 py-4">
          <h2 className="text-sm font-semibold">Review an email draft</h2>
          <p className="mt-1 text-xs text-muted-foreground">The host executes only authorized agent tools. Saving a draft or requesting approval never sends it.</p>
          {!composeCanDraft && <p role="alert" className="mt-2 text-xs text-destructive">Draft creation is unavailable. Ask an admin to enable Draft mail and confirm your email.write permission.</p>}
          {!composeMailboxes.length && <p role="alert" className="mt-2 text-xs text-destructive">No connected primary mailbox is assigned to this agent. Assign one in Agent Channels.</p>}
          <div className="mt-3 grid gap-3">
            <label className="text-xs font-medium">From mailbox<select aria-label="Sending mailbox" value={composeAccount} disabled={composeBusy || Boolean(composeDraftId)} onChange={e => { setComposeAccount(e.target.value); setComposeDraftId(null); }} className="mt-1 block w-full rounded-md border bg-background p-2">{composeMailboxes.map(account => <option key={account.id} value={account.id}>{account.address}</option>)}</select></label>
            <label className="text-xs font-medium">To<input type="email" aria-label="Email recipient" value={composeTo} onChange={e => { setComposeTo(e.target.value); setComposeDraftId(null); }} className="mt-1 block w-full rounded-md border bg-background p-2" /></label>
            <label className="text-xs font-medium">Subject<input value={composeSubject} maxLength={998} onChange={e => { setComposeSubject(e.target.value); setComposeDraftId(null); }} className="mt-1 block w-full rounded-md border bg-background p-2" /></label>
            <label className="text-xs font-medium">Message<textarea aria-label="Email body" value={composeBody} maxLength={100000} rows={5} onChange={e => { setComposeBody(e.target.value); setComposeDraftId(null); }} className="mt-1 block w-full rounded-md border bg-background p-2" /></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={composeBusy || !composeCanDraft || !composeAccount || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim() || Boolean(composeDraftId)} onClick={() => void submitMailCompose("draft")} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Save email draft</button>
            <button type="button" disabled={composeBusy || !composeCanApprove || !composeDraftId || Boolean(composeActionId)} onClick={() => void submitMailCompose("request_approval")} className="rounded-md border px-4 py-2 text-xs font-semibold disabled:opacity-50">Request send approval</button>
            <a href="/mail/approvals" className="rounded-md border px-4 py-2 text-xs font-medium">Review approvals</a>
          </div>
          {composeDraftId && <p className="mt-2 text-xs text-muted-foreground">Draft saved. Review the content above before requesting approval.</p>}
          {composeActionId && <p role="status" className="mt-2 text-xs text-muted-foreground">Approval request created (pending_approval). The email has not been sent.</p>}
        </section>
      )}
      {mailPermissionNotice && <p role="status" className="mx-auto w-full max-w-3xl px-4 py-2 text-xs text-muted-foreground">{mailPermissionNotice}</p>}
      {mailPermissionOpen && mailPolicy && !voiceOpen && (
        <section aria-label="Agent mail permissions" className="mx-auto w-full max-w-3xl border-b px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Agent mail permissions</h2>
            <span className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={mailPermissionBusy || busy} onClick={() => void reloadMailPermissions()} className="text-xs underline disabled:opacity-50">Reload current permissions</button>
              <a href={`/agents/${agentId}?tab=policy`} className="text-xs underline">Full policy and mailbox setup</a>
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Administrator-only. Choose a preset, adjust individual tools if needed, then confirm to save. Mailboxes and user permissions are separate requirements.</p>
          <div className="mt-3 flex flex-wrap gap-2">{EMAIL_PERMISSION_PRESETS.map(preset => <button type="button" key={preset.id} disabled={mailPermissionBusy} title={preset.description}
            onClick={() => setMailToolSelection(current => emailPermissionPresetSelection(current, preset.id))}
            className="rounded-md border bg-background px-3 py-2 text-xs hover:border-primary disabled:opacity-50">{preset.label}</button>)}</div>
          <details className="mt-3 rounded-md border p-3">
            <summary className="cursor-pointer text-xs font-semibold">Fine-tune email tool permissions</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{REGISTERED_EMAIL_POLICY_NAMES.map(name => <label key={name} className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={mailPermissionBusy || busy} checked={mailToolSelection.includes(name)} onChange={event => setMailToolSelection(current => event.target.checked ? [...new Set([...current, name])] : current.filter(n => n !== name))} />{EMAIL_PERMISSION_LABELS[name] ?? name}</label>)}</div>
          </details>
          <p className="mt-2 text-xs text-muted-foreground">{mailToolSelection.filter(name => REGISTERED_EMAIL_POLICY_NAMES.some(registered => registered === name)).length} email tools selected. Unrelated custom permissions are preserved. No permission changes take effect before saving.</p>
          <button type="button" disabled={mailPermissionBusy || busy} onClick={() => void saveMailPermissions()} className="mt-3 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Confirm and save permissions</button>
        </section>
      )}
      {voiceOpen ? (
        <VoiceWorkspace organizationId={organizationId} agents={agents} initialAgentId={agentId}
          conversationId={conversationId} embedded onReturnToChat={() => { void returnFromVoice(); }} />
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
                  {catchUpEnabled ? <a href="/catch-up" className="mb-3 inline-flex items-center rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10">Catch up on my mail →</a> : null}
                  {["What needs my attention today?", "Summarize my recent emails", "Show emails from the last hour"].map((prompt) =>
                    <button key={prompt} onClick={() => setDraft(prompt)} className="rounded-lg border bg-card px-3.5 py-2.5 text-left text-sm transition hover:border-primary/30 hover:bg-accent/5">{prompt}</button>
                  )}
                </div>
              </div>
            </div>
          ) : messages.map((message) => (
            <MessageBubble key={message.id} role={message.role} content={message.content} />
          ))}
          {activitySteps.length > 0 ? (
            <details className="max-w-2xl rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm" open={busy}>
              <summary className="cursor-pointer list-none font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className={`size-2 rounded-full ${busy ? "animate-pulse bg-primary" : "bg-muted-foreground/50"}`} />
                  {busy ? "Clara is working" : "How this answer was prepared"}
                </span>
              </summary>
              <ol aria-label="Observed agent steps" className="mt-3 space-y-2 border-l border-border pl-4 text-xs text-muted-foreground">
                {activitySteps.map((phase, index) => (
                  <li key={`${phase}-${index}`} className="relative pl-1">
                    <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-1.5 rounded-full bg-muted-foreground/60" />
                    {agentActivityLabel(phase)}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[11px] text-muted-foreground">Activity steps reflect actual system events, not private AI reasoning.</p>
            </details>
          ) : null}
          {busy && !responseStarted && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-0 bg-background pb-4 pt-2">
          <div className="rounded-2xl border border-border bg-card shadow-sm focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
            <textarea
              ref={composerRef}
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
