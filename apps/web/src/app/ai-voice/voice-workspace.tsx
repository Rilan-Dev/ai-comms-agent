"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Agent = { id: string; name: string; status: string };
type VoiceSession = { id: string; status: string; provider?: string | null; model?: string | null };\ntype Transport = { sessionEndpoint?: string; provider?: string | null; model?: string | null; voiceId?: string | null };

export function VoiceWorkspace({ organizationId, agents }: { organizationId: string; agents: Agent[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");\n  const [transport, setTransport] = useState<Transport | null>(null);\n  const [micState, setMicState] = useState<"idle" | "requesting" | "ready" | "denied">("idle");\n  const streamRef = useRef<MediaStream | null>(null);
  const [notice, setNotice] = useState("Voice transport is Clara-owned. This host boundary never exposes provider credentials.");
  const agent = useMemo(() => agents.find((item) => item.id === agentId) ?? agents[0], [agents, agentId]);\n\n  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  async function start() {
    if (!agent || busy) return;
    setBusy(true); setError(""); setNotice("Resolving Clara voice configuration…");
    try {
      const response = await fetch("/api/voice/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, agentId: agent.id }) });
      const payload = await response.json().catch(() => ({})) as { session?: VoiceSession; transport?: { sessionEndpoint?: string }; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Voice session could not start.");
      setSession(payload.session ?? null);
      setNotice(payload.transport?.sessionEndpoint ? "Clara resolved the realtime transport boundary. Provider credentials remain server-side." : "Voice session created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Voice session failed.");
      setNotice("No provider connectivity was fabricated. Configure Clara voice credentials to enable transport.");
    } finally { setBusy(false); }
  }

  async function stop() {
    if (!session || busy) return;
    setBusy(true);
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());\n      streamRef.current = null;\n      await fetch("/api/voice/session", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, sessionId: session.id, reason: "user_ended" }) });
      setSession((current) => current ? { ...current, status: "ended" } : null);\n      setTransport(null);\n      setMicState("idle");
      setNotice("Voice session ended and persisted.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,.10),transparent_32%)] p-5 sm:p-8">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Clara realtime voice</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Talk to your communication agent</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Host-authorized session lifecycle around Clara. Provider routing, realtime transport, streaming, interruption and reconnect stay Clara-owned.</p></div>
        <label className="rounded-xl border bg-background px-3 py-2 text-sm"><span className="mr-2 text-xs text-muted-foreground">Agent</span><select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="bg-transparent font-semibold outline-none">{agents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </header>
      <section className="mt-8 grid gap-5 md:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-[2rem] border bg-background p-7 shadow-sm"><div className="grid min-h-[360px] place-items-center text-center"><div><div className="mx-auto grid h-24 w-24 place-items-center rounded-full border-8 border-primary/10 bg-primary/5 text-3xl">◉</div><h2 className="mt-6 text-xl font-semibold">{session?.status === "active" ? "Voice session active" : session?.status === "ended" ? "Session ended" : "Ready to connect"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{notice}</p>{error ? <p className="mx-auto mt-3 max-w-md rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p> : null}<div className="mt-6">{session?.status === "active" ? <button onClick={() => void stop()} disabled={busy} className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-50">End session</button> : <button onClick={() => void start()} disabled={busy || !agent} className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background hover:-translate-y-0.5 disabled:opacity-50">{busy ? "Connecting…" : "Start voice session"}</button>}</div></div></div></div>
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-background p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Session</p><dl className="mt-4 space-y-3 text-sm"><Row label="Provider" value={session?.provider ?? "Not resolved"} /><Row label="Model" value={session?.model ?? "Not resolved"} /><Row label="Session ID" value={session?.id ? session.id.slice(0, 12) + "…" : "—"} /><Row label="Credentials" value="Server-side only" /><Row label="Microphone" value={micState === "ready" ? "Ready" : micState === "requesting" ? "Requesting…" : micState === "denied" ? "Blocked" : "Off"} /><Row label="Transport" value={transport?.sessionEndpoint ? "Resolved" : "Not resolved"} /></dl></div>
          <div className="rounded-2xl border bg-background p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Safety boundary</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Voice-originated business actions continue through the same authorization and approval boundary as chat. The browser never receives provider API keys.</p></div>
        </aside>
      </section>
    </div>
  </main>;
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="max-w-[180px] truncate text-right font-medium">{value}</span></div>; }
