"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isCurrentVoiceSequence } from "@ai-comms-agent/shared";
import { AudioLines, Mic, PhoneOff, Send, ShieldCheck } from "lucide-react";

type Agent = { id: string; name: string; status: string };
type VoiceSession = { id: string; status: string; provider?: string | null; model?: string | null };
type Transport = { transportMode?: "transcript_bridge" | "realtime"; turnEndpoint?: string; provider?: string | null; model?: string | null; voiceId?: string | null };

export function VoiceWorkspace({ organizationId, agents }: { organizationId: string; agents: Agent[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  const [transcript, setTranscript] = useState("");
  const [responseText, setResponseText] = useState("");
  const [busy, setBusy] = useState(false);
  const [turnBusy, setTurnBusy] = useState(false);
  const [error, setError] = useState("");
  const [micState, setMicState] = useState<"idle" | "requesting" | "ready" | "denied">("idle");
  const [notice, setNotice] = useState("Voice transport is Clara-owned. Provider credentials remain server-side.");
  const streamRef = useRef<MediaStream | null>(null);
  const turnAbortRef = useRef<AbortController | null>(null);
  const turnSequenceRef = useRef(0);

  const agent = useMemo(() => agents.find((item) => item.id === agentId) ?? agents[0], [agents, agentId]);

  useEffect(() => () => {
    turnAbortRef.current?.abort();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function requestMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState("denied");
      throw new Error("This browser does not expose microphone access.");
    }
    setMicState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicState("ready");
    } catch {
      setMicState("denied");
      throw new Error("Microphone access was denied. Allow microphone access and try again.");
    }
  }

  async function start() {
    if (!agent || busy) return;
    setBusy(true);
    setError("");
    try {
      // Do not request microphone permission until a real realtime adapter is
      // available. The current host runtime exposes only the authorized HTTP
      // transcript bridge; microphone readiness is not transport readiness.
      setNotice("Initializing the authorized transcript bridge. Realtime audio is not connected.");
      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, agentId: agent.id }),
      });
      const payload = await response.json().catch(() => ({})) as {
        session?: VoiceSession;
        transport?: Transport;
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Voice session could not start.");
      setSession(payload.session ?? null);
      setTransport(payload.transport ?? null);
      setNotice(payload.transport?.transportMode === "realtime"
        ? "Realtime transport descriptor received; waiting for the provider adapter to confirm readiness."
        : "Session initialized. Realtime audio is not connected; use the authorized text transcript bridge below.");
    } catch (e) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setMicState("idle");
      setError(e instanceof Error ? e.message : "Voice session failed.");
      setNotice("Session startup failed. No provider connection was established.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTurn() {
    const text = transcript.trim();
    if (!session || session.status === "ended" || !text || turnBusy) return;

    turnAbortRef.current?.abort();
    const controller = new AbortController();
    turnAbortRef.current = controller;
    const sequence = ++turnSequenceRef.current;
    const startedAt = performance.now();

    setTurnBusy(true);
    setError("");
    setNotice("Clara is processing the transcript…");
    try {
      const response = await fetch("/api/voice/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          organizationId,
          agentId: agent?.id,
          sessionId: session.id,
          transcript: text,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { text?: string; message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Voice turn failed.");
      if (!isCurrentVoiceSequence(turnSequenceRef.current, sequence) || controller.signal.aborted) return;
      setResponseText(payload.text ?? "");
      setTranscript("");
      void fetch("/api/voice/session", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          sessionId: session.id,
          action: "telemetry",
          metricName: "voice.turn.round_trip",
          metricValue: performance.now() - startedAt,
          unit: "ms",
          stage: "browser_turn",
          metadata: { sequence },
        }),
      }).catch(() => undefined);
      setNotice("Response received. A later turn safely supersedes an interrupted request.");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Voice turn failed.");
      setNotice("The turn failed safely; no external action was claimed.");
    } finally {
      if (isCurrentVoiceSequence(turnSequenceRef.current, sequence)) setTurnBusy(false);
    }
  }

  async function stop() {
    if (!session || busy) return;
    setBusy(true);
    turnAbortRef.current?.abort();
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      await fetch("/api/voice/session", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, sessionId: session.id, reason: "user_ended" }),
      });
      setSession((current) => current ? { ...current, status: "ended" } : null);
      setTransport(null);
      setMicState("idle");
      setNotice("Voice session ended and persisted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-background p-5 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Clara realtime voice</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Talk to your communication agent<span className="text-tertiary">.</span></h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Host-authorized session lifecycle around Clara. Provider routing, realtime transport, streaming,
              interruption and reconnect remain Clara-owned.
            </p>
          </div>
          <label className="rounded-md border bg-background px-3 py-2 text-sm">
            <span className="mr-2 text-xs text-muted-foreground">Agent</span>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="bg-transparent font-semibold outline-none">
              {agents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-md border bg-background p-7 shadow-sm">
            <div className="grid min-h-[360px] place-items-center text-center">
              <div className="w-full max-w-xl">
                <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border-8 border-primary/10 bg-primary/5 text-primary"><AudioLines size={38} aria-hidden="true" /></div>
                <h2 className="mt-6 text-xl font-semibold">
                  {session?.status === "active" ? "Session initialized" : session?.status === "ended" ? "Session ended" : "Ready to connect"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{notice}</p>
                {error ? <p className="mx-auto mt-3 max-w-md rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p> : null}

                <div className="mt-6 flex justify-center gap-3">
                  {session?.status === "active" ? (
                    <button onClick={() => void stop()} disabled={busy} className="rounded-md border px-5 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-50">
                      End session
                    </button>
                  ) : (
                    <button onClick={() => void start()} disabled={busy || !agent} className="rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background hover:-translate-y-0.5 disabled:opacity-50">
                      {busy ? "Connecting…" : "Start voice session"}
                    </button>
                  )}
                </div>

                {session?.status === "active" ? (
                  <div className="mt-8 rounded-md border border-border bg-secondary/50 p-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="voice-transcript" className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">
                        Transcript bridge
                      </label>
                      <span className="text-xs text-muted-foreground">Mic: {micState === "ready" ? "ready" : micState}</span>
                    </div>
                    <textarea
                      id="voice-transcript"
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendTurn();
                        }
                      }}
                      placeholder="Type a message for Clara. Live microphone transcription is not connected yet…"
                      className="mt-3 min-h-24 w-full resize-y rounded-md border bg-background p-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Enter sends · Shift+Enter adds a line</span>
                      <button onClick={() => void sendTurn()} disabled={turnBusy || !transcript.trim()} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                        {turnBusy ? "Thinking…" : "Send turn"}
                      </button>
                    </div>
                    {responseText ? (
                      <div className="mt-4 rounded-md border bg-background p-4">
                        <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Assistant</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{responseText}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-md border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Session</p>
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Provider" value={session?.provider ?? "Not resolved"} />
                <Row label="Model" value={session?.model ?? "Not resolved"} />
                <Row label="Session ID" value={session?.id ? session.id.slice(0, 12) + "…" : "—"} />
                <Row label="Credentials" value="Server-side only" />
                <Row label="Microphone" value={micState === "ready" ? "Ready" : micState === "requesting" ? "Requesting…" : micState === "denied" ? "Blocked" : "Off"} />
                <Row label="Transport" value={transport?.transportMode === "realtime" ? "Awaiting adapter readiness" : transport?.turnEndpoint ? "HTTP transcript bridge only" : "Not connected"} />
              </dl>
            </div>
            <div className="rounded-md border bg-background p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground"><ShieldCheck size={14} /> Safety boundary</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Voice-originated business actions continue through the same authorization and approval boundary as chat.
                The browser never receives provider API keys.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[180px] truncate text-right font-medium">{value}</span>
    </div>
  );
}
