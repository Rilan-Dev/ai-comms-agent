"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCurrentVoiceSequence } from "@ai-comms-agent/shared";
import { AudioLines, CheckCircle2, CircleStop, Mic, MicOff, Radio, ShieldCheck, Waves } from "lucide-react";

type Agent = { id: string; name: string; status: string };
type VoiceSession = { id: string; status: string; provider?: string | null; model?: string | null; voice_id?: string | null };
type Transport = { transportMode?: "transcript_bridge" | "realtime"; sessionEndpoint?: string; turnEndpoint?: string; provider?: string | null; realtimeProvider?: string | null; model?: string | null; voiceId?: string | null };
type Turn = { id: string; role: "user" | "assistant"; text: string; state?: "thinking" | "done" };

export function VoiceWorkspace({ organizationId, agents }: { organizationId: string; agents: Agent[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  const [transcript, setTranscript] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Your voice session will connect through Clara's authorized runtime.");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionCreatedRef = useRef(false);
  const activationStartedRef = useRef(false);
  const providerSessionIdRef = useRef<string | null>(null);
  const finalizedItemsRef = useRef(new Set<string>());
  const turnSequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const agent = useMemo(() => agents.find((item) => item.id === agentId) ?? agents[0], [agents, agentId]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const stopMedia = useCallback(() => {
    try { channelRef.current?.close(); } catch {}
    channelRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    sessionCreatedRef.current = false;
    activationStartedRef.current = false;
    providerSessionIdRef.current = null;
    setConnected(false);
    setSpeaking(false);
    setMicMuted(false);
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    stopMedia();
  }, [stopMedia]);

  const patchSession = useCallback(async (body: Record<string, unknown>) => {
    const current = sessionRef.current;
    if (!current) return;
    const response = await fetch("/api/voice/session", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId, sessionId: current.id, ...body }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Voice session state could not be updated.");
    if (payload.session) setSession(payload.session as VoiceSession);
  }, [organizationId]);

  const maybeActivate = useCallback(async () => {
    const pc = pcRef.current;
    const channel = channelRef.current;
    if (!pc || !channel || pc.connectionState !== "connected" || channel.readyState !== "open" || !sessionCreatedRef.current || activationStartedRef.current) return;
    activationStartedRef.current = true;
    try {
      await patchSession({ action: "activate", providerSessionId: providerSessionIdRef.current });
      setConnected(true);
      setNotice("Realtime audio connected. Speak naturally; Clara routes recognized speech through the host-authorized turn pipeline.");
      if (channel.readyState === "open") {
        channel.send(JSON.stringify({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            instructions: "Say exactly: Hello, I'm Clara. How can I help you with your email and communication tasks today?",
          },
        }));
      }
    } catch (e) {
      activationStartedRef.current = false;
      setError(e instanceof Error ? e.message : "Could not persist the connected voice state.");
      stopMedia();
    }
  }, [patchSession, stopMedia]);

  const submitHostTurn = useCallback(async (rawText: string, speakAnswer: boolean) => {
    const text = rawText.trim();
    const current = sessionRef.current;
    if (!current || !agent || !text) return;
    const sequence = ++turnSequenceRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const userTurn: Turn = { id: `user-${sequence}`, role: "user", text, state: "done" };
    const assistantTurn: Turn = { id: `assistant-${sequence}`, role: "assistant", text: "", state: "thinking" };
    setTurns((old) => [...old, userTurn, assistantTurn]);
    setNotice("Clara is processing your request through the authorized host runtime.");
    try {
      const response = await fetch("/api/voice/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ organizationId, agentId: agent.id, sessionId: current.id, transcript: text }),
      });
      const payload = await response.json().catch(() => ({})) as { text?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Voice turn failed.");
      if (!isCurrentVoiceSequence(turnSequenceRef.current, sequence) || controller.signal.aborted) return;
      const answer = payload.text?.trim() || "I couldn't produce a response for that turn.";
      setTurns((old) => old.map((turn) => turn.id === assistantTurn.id ? { ...turn, text: answer, state: "done" } : turn));
      setNotice(speakAnswer ? "Answer received from Clara. Playing the spoken response." : "Response received.");
      if (speakAnswer) {
        const channel = channelRef.current;
        if (!channel || channel.readyState !== "open") throw new Error("The voice transport disconnected before the answer could be spoken.");
        channel.send(JSON.stringify({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            instructions: `Speak the following answer exactly and naturally. Do not add facts, email details, or actions beyond this answer:\n\n${answer}`,
          },
        }));
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : "Voice turn failed.";
      setError(message);
      setTurns((old) => old.map((turn) => turn.id === assistantTurn.id ? { ...turn, text: message, state: "done" } : turn));
      setNotice("This turn failed. No external action is claimed as completed.");
    }
  }, [agent, organizationId]);

  async function connectRealtime(current: VoiceSession, descriptor: Transport) {
    if (!descriptor.sessionEndpoint || descriptor.realtimeProvider !== "openai") {
      throw new Error("This provider does not have a native realtime transport configured. No live connection was started.");
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      throw new Error("This browser does not support realtime microphone audio. Open the app over HTTPS or localhost in a supported browser.");
    }
    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    audioRef.current = audio;
    pc.ontrack = (event) => {
      audio.srcObject = event.streams[0];
      void audio.play().catch(() => setNotice("Voice is connected; tap the page once if your browser blocks audio playback."));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") void maybeActivate();
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        setConnected(false);
        if (pc.connectionState === "failed") setError("Realtime transport connection failed. End the session and reconnect.");
      }
    };
    const channel = pc.createDataChannel("oai-events");
    channelRef.current = channel;
    channel.onopen = () => { void maybeActivate(); };
    channel.onmessage = (event) => {
      let data: Record<string, unknown>;
      try { data = JSON.parse(String(event.data)) as Record<string, unknown>; } catch { return; }
      const type = String(data.type ?? "");
      if (type === "session.created" || type === "session.updated") {
        const providerSession = data.session && typeof data.session === "object" ? data.session as Record<string, unknown> : null;
        if (typeof providerSession?.id === "string") providerSessionIdRef.current = providerSession.id;
        sessionCreatedRef.current = true;
        void maybeActivate();
      } else if (type === "input_audio_buffer.speech_started") {
        setNotice("Listening…");
      } else if (type === "response.created") {
        setSpeaking(true);
        setNotice("Clara is speaking.");
      } else if (type === "response.done") {
        setSpeaking(false);
        setNotice("Connected and listening.");
      } else if (type === "conversation.item.input_audio_transcription.completed") {
        const itemId = typeof data.item_id === "string" ? data.item_id : `transcript-${String(data.transcript ?? "")}`;
        const recognized = typeof data.transcript === "string" ? data.transcript.trim() : "";
        if (recognized && !finalizedItemsRef.current.has(itemId)) {
          finalizedItemsRef.current.add(itemId);
          void submitHostTurn(recognized, true);
        }
      } else if (type === "error") {
        const detail = data.error && typeof data.error === "object" ? (data.error as Record<string, unknown>).message : null;
        setError(typeof detail === "string" ? detail : "The realtime provider reported an error.");
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const started = Date.now();
    while (!pc.localDescription?.sdp && Date.now() - started < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const sdp = pc.localDescription?.sdp;
    if (!sdp) throw new Error("Browser did not produce a WebRTC SDP offer.");
    const response = await fetch(descriptor.sessionEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId, agentId: agent?.id, sessionId: current.id, sdp }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
      throw new Error(payload.message ?? payload.error ?? `Realtime negotiation failed (${response.status}).`);
    }
    const answerSdp = await response.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    setNotice("Negotiating secure realtime audio transport…");

    // Do not leave the UI indefinitely in a connecting state when SDP
    // negotiation succeeds but the provider channel never becomes ready.
    const deadline = Date.now() + 20_000;
    while (!(pc.connectionState === "connected" && channel.readyState === "open" && sessionCreatedRef.current)) {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        throw new Error("The provider closed the realtime connection before the session became ready.");
      }
      if (Date.now() >= deadline) {
        throw new Error("Realtime session readiness timed out. Check provider access and network connectivity, then reconnect.");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await maybeActivate();
  }

  async function start() {
    if (!agent || busy) return;
    setBusy(true);
    setError("");
    setTurns([]);
    finalizedItemsRef.current.clear();
    setNotice("Authorizing and initializing the voice session…");
    try {
      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, agentId: agent.id }),
      });
      const payload = await response.json().catch(() => ({})) as { session?: VoiceSession; transport?: Transport; message?: string; error?: string };
      if (!response.ok || !payload.session || !payload.transport) throw new Error(payload.message ?? payload.error ?? "Voice session could not start.");
      setSession(payload.session);
      sessionRef.current = payload.session;
      setTransport(payload.transport);
      if (payload.transport.transportMode === "realtime") {
        await connectRealtime(payload.session, payload.transport);
      } else {
        setNotice("This provider is configured for the authorized text bridge, not live microphone audio. The session is not marked connected.");
      }
    } catch (e) {
      stopMedia();
      const message = e instanceof Error ? e.message : "Voice session failed.";
      setError(message);
      setNotice("Session startup failed; no live connection is claimed.");
      const current = sessionRef.current;
      if (current && current.status !== "ended") {
        void fetch("/api/voice/session", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId, sessionId: current.id, reason: "transport_start_failed" }),
        }).catch(() => undefined);
      }
      setSession((current) => current ? { ...current, status: "error" } : null);
    } finally {
      setBusy(false);
    }
  }

  async function sendTextTurn() {
    const text = transcript.trim();
    if (!text || busy) return;
    setTranscript("");
    await submitHostTurn(text, false);
  }

  async function endSession() {
    if (!session || busy) return;
    setBusy(true);
    abortRef.current?.abort();
    stopMedia();
    try {
      await fetch("/api/voice/session", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, sessionId: session.id, reason: "user_ended" }),
      });
      setSession((current) => current ? { ...current, status: "ended" } : null);
      sessionRef.current = null;
      setTransport(null);
      setNotice("Voice session ended and microphone resources released.");
    } finally {
      setBusy(false);
    }
  }

  function toggleMute() {
    const next = !micMuted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMicMuted(next);
    setNotice(next ? "Microphone muted. The realtime session remains connected." : "Microphone unmuted. Listening for speech.");
  }

  function interrupt() {
    if (channelRef.current?.readyState === "open") {
      channelRef.current.send(JSON.stringify({ type: "response.cancel" }));
    }
    setSpeaking(false);
    setNotice("Assistant response interrupted.");
  }

  const liveSession = session?.status === "starting" || session?.status === "active";
  const bridgeOnly = transport?.transportMode === "transcript_bridge";

  return (
    <main className="min-h-[calc(100vh-72px)] bg-background px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-primary"><Waves size={14} /> Clara voice workspace</p>
            <h1 className="mt-2 font-display text-3xl font-medium tracking-tight sm:text-4xl">Talk to your communication agent<span className="text-tertiary">.</span></h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A live conversation surface with explicit transport state, turn history, and host-authorized answers.</p>
          </div>
          <label className="rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
            <span className="mr-3 text-xs text-muted-foreground">Agent</span>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} disabled={liveSession} className="max-w-48 bg-transparent font-semibold outline-none">
              {agents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </header>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
          <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Radio size={16} className={connected ? "text-emerald-500" : "text-muted-foreground"} /> Live conversation</div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${connected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-border text-muted-foreground"}`}>
                {connected ? "Connected" : busy ? "Connecting" : session?.status === "ended" || session?.status === "error" ? "Ended" : "Not connected"}
              </span>
            </div>

            <div className="grid min-h-[320px] place-items-center px-5 py-8 text-center sm:min-h-[370px]">
              <div>
                <div className={`relative mx-auto grid h-32 w-32 place-items-center rounded-full border bg-primary/[0.04] text-primary shadow-inner ${speaking ? "border-primary/60" : "border-primary/15"}`}>
                  {connected ? <span className={`absolute inset-2 rounded-full border border-primary/20 ${speaking ? "animate-ping" : ""}`} /> : null}
                  <span className="absolute inset-5 rounded-full border border-primary/15" />
                  {speaking ? <AudioLines size={42} className="relative" /> : connected ? <Waves size={42} className="relative" /> : <Mic size={42} className="relative opacity-70" />}
                </div>
                <h2 className="mt-6 text-xl font-semibold">{connected ? speaking ? "Clara is speaking" : micMuted ? "Microphone muted" : "Listening to you" : busy ? "Establishing secure audio…" : session?.status === "starting" ? "Session initialized" : session?.status === "ended" ? "Conversation ended" : "Ready when you are"}</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{notice}</p>
                {error ? <p role="alert" className="mx-auto mt-4 max-w-lg rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-left text-sm text-destructive">{error}</p> : null}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {!liveSession ? (
                    <button onClick={() => void start()} disabled={busy || !agent} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50">
                      <Mic size={16} /> {busy ? "Connecting…" : "Start conversation"}
                    </button>
                  ) : (
                    <>
                      {connected ? <button onClick={toggleMute} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-muted">{micMuted ? <Mic size={16} /> : <MicOff size={16} />}{micMuted ? "Unmute" : "Mute"}</button> : null}
                      {connected && speaking ? <button onClick={interrupt} className="rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-muted">Interrupt</button> : null}
                      <button onClick={() => void endSession()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"><CircleStop size={16} /> End session</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t bg-muted/20 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">{bridgeOnly ? "Text fallback" : "Conversation transcript"}</p>
                {connected ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={13} /> Audio transport ready</span> : null}
              </div>
              {turns.length ? (
                <div className="mb-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                  {turns.map((turn) => (
                    <article key={turn.id} className={`max-w-[92%] rounded-2xl border px-4 py-3 text-left ${turn.role === "user" ? "ml-auto bg-primary/5" : "mr-auto bg-background"}`}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">{turn.role === "user" ? "You" : "Clara"}{turn.state === "thinking" ? " · thinking…" : ""}</p>
                      <p className="whitespace-pre-wrap text-sm leading-6">{turn.text || "Preparing response…"}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mb-4 rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">{connected ? "Your conversation will appear here as you speak." : "Start a session to begin. Live audio is only enabled when a real provider transport is available."}</p>
              )}
              {liveSession && (bridgeOnly || !connected) ? (
                <form onSubmit={(event) => { event.preventDefault(); void sendTextTurn(); }} className="flex flex-col gap-2 sm:flex-row">
                  <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Type a message to Clara…" rows={2} className="min-h-12 flex-1 resize-y rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <button type="submit" disabled={!transcript.trim() || busy} className="self-stretch rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-40">Send text</button>
                </form>
              ) : null}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Connection details</p>
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Provider" value={session?.provider ?? "Not resolved"} />
                <Row label="Model" value={session?.model ?? "Not resolved"} />
                <Row label="Session" value={session?.id ? session.id.slice(0, 14) + "…" : "—"} />
                <Row label="Microphone" value={connected ? micMuted ? "Muted" : "Live" : "Not connected"} />
                <Row label="Transport" value={connected ? "WebRTC ready" : bridgeOnly ? "Authorized text bridge" : busy ? "Negotiating" : "Not connected"} />
                <Row label="Provider key" value="Server-side only" />
              </dl>
            </div>
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground"><ShieldCheck size={15} /> Authorization boundary</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Recognized speech is submitted to the authenticated host turn endpoint. Email data and business actions must be authorized by the selected organization, agent, and mailbox grants; the browser never receives the provider's long-lived API key.</p>
            </div>
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Session checklist</p>
              <ul className="mt-4 space-y-3 text-sm">
                <Checklist label="Host session authorized" checked={Boolean(session)} />
                <Checklist label="Realtime transport connected" checked={connected} />
                <Checklist label="Microphone audio enabled" checked={connected && !micMuted} />
                <Checklist label="Session teardown available" checked={Boolean(liveSession)} />
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="max-w-[180px] truncate text-right font-medium">{value}</span></div>;
}

function Checklist({ label, checked }: { label: string; checked: boolean }) {
  return <li className="flex items-center gap-2"><CheckCircle2 size={15} className={checked ? "text-emerald-500" : "text-muted-foreground/40"} /><span className={checked ? "" : "text-muted-foreground"}>{label}</span></li>;
}
