"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCurrentVoiceSequence } from "@ai-comms-agent/shared";
import { AudioLines, CheckCircle2, CircleStop, Mic, MicOff, Radio, ShieldCheck, Waves } from "lucide-react";

type Agent = { id: string; name: string; status: string };
type VoiceSession = { id: string; status: string; provider?: string | null; model?: string | null; voice_id?: string | null };
type Transport = { transportMode?: "transcript_bridge" | "realtime" | "pipeline"; sessionEndpoint?: string; turnEndpoint?: string; provider?: string | null; realtimeProvider?: string | null; model?: string | null; voiceId?: string | null };
type Turn = { id: string; role: "user" | "assistant"; text: string; state?: "thinking" | "done" };

export function VoiceWorkspace({ organizationId, agents }: { organizationId: string; agents: Agent[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [languageCode, setLanguageCode] = useState("en-IN");
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  const [transcript, setTranscript] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Array<{ actionId: string; actionType: string; message: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Your voice session will connect through Clara's authorized runtime.");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const geminiSocketRef = useRef<WebSocket | null>(null);
  const providerSocketRef = useRef<WebSocket | null>(null);
  const ttsSocketRef = useRef<WebSocket | null>(null);
  const ttsAudioContextRef = useRef<AudioContext | null>(null);
  const ttsNextStartRef = useRef(0);
  const ttsSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const ttsGenerationRef = useRef<string | null>(null);
  const ttsFinalSeenRef = useRef(false);
  const ttsPendingFramesRef = useRef(0);
  const lastProviderFinalRef = useRef<{ text: string; at: number } | null>(null);
  const geminiAudioContextRef = useRef<AudioContext | null>(null);
  const geminiProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const geminiSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const geminiTranscriptRef = useRef("");
  const pipelineSamplesRef = useRef<Int16Array[]>([]);
  const pipelinePreRollRef = useRef<Int16Array[]>([]);
  const pipelineSpeechStartedRef = useRef(false);
  const pipelineBusyRef = useRef(false);
  const pipelineLastVoiceAtRef = useRef(0);
  const ttsObjectUrlRef = useRef<string | null>(null);
  const micMutedRef = useRef(false);
  const expectedDisconnectRef = useRef(false);
  const realtimeProviderRef = useRef<string | null>(null);
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
    expectedDisconnectRef.current = true;
    try { channelRef.current?.close(); } catch {}
    try { geminiSocketRef.current?.close(); } catch {}
    try { providerSocketRef.current?.close(); } catch {}
    try { ttsSocketRef.current?.close(); } catch {}
    geminiSocketRef.current = null;
    providerSocketRef.current = null;
    ttsSocketRef.current = null;
    for (const source of ttsSourcesRef.current) { try { source.stop(); } catch {} }
    ttsSourcesRef.current.clear();
    if (ttsAudioContextRef.current) void ttsAudioContextRef.current.close().catch(() => undefined);
    ttsAudioContextRef.current = null;
    ttsNextStartRef.current = 0;
    ttsGenerationRef.current = null;
    ttsFinalSeenRef.current = false;
    ttsPendingFramesRef.current = 0;
    lastProviderFinalRef.current = null;
    geminiProcessorRef.current?.disconnect();
    geminiSourceRef.current?.disconnect();
    geminiProcessorRef.current = null;
    geminiSourceRef.current = null;
    if (geminiAudioContextRef.current) void geminiAudioContextRef.current.close().catch(() => undefined);
    geminiAudioContextRef.current = null;
    geminiTranscriptRef.current = "";
    pipelineSamplesRef.current = [];
    pipelinePreRollRef.current = [];
    pipelineSpeechStartedRef.current = false;
    pipelineBusyRef.current = false;
    pipelineLastVoiceAtRef.current = 0;
    if (ttsObjectUrlRef.current) URL.revokeObjectURL(ttsObjectUrlRef.current);
    ttsObjectUrlRef.current = null;
    micMutedRef.current = false;
    realtimeProviderRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    channelRef.current = null;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
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
    if (payload.session) {
      const updated = payload.session as VoiceSession;
      sessionRef.current = updated;
      setSession(updated);
    }
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
      const payload = await response.json().catch(() => ({})) as { text?: string; message?: string; error?: string; toolCalls?: Array<{ name: string; ok: boolean; errorCode?: string }>; pendingApprovals?: Array<{ actionId: string; actionType: string; message: string }> };
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Voice turn failed.");
      if (!isCurrentVoiceSequence(turnSequenceRef.current, sequence) || controller.signal.aborted) return;
      const answer = payload.text?.trim() || "I couldn't produce a response for that turn.";
      setTurns((old) => old.map((turn) => turn.id === assistantTurn.id ? { ...turn, text: answer, state: "done" } : turn));
      setPendingApprovals((old) => [...old, ...(payload.pendingApprovals ?? [])]);
      const succeeded = payload.toolCalls?.filter((call) => call.ok).length ?? 0;
      const denied = payload.toolCalls?.filter((call) => !call.ok).length ?? 0;
      const approvalSummary = payload.pendingApprovals?.length ? ` ${payload.pendingApprovals.length} email action(s) need explicit approval; none were sent yet.` : "";
      const toolSummary = (payload.toolCalls?.length ? ` Email tools: ${succeeded} succeeded, ${denied} denied or failed.` : "") + approvalSummary;
      setNotice((speakAnswer ? "Answer received from Clara. Playing the spoken response." : "Response received.") + toolSummary);
      if (speakAnswer) {
        const channel = channelRef.current;
        if (realtimeProviderRef.current === "sarvam" || realtimeProviderRef.current === "elevenlabs") {
          const provider = realtimeProviderRef.current;
          const response = await fetch("/api/voice/speech/speak", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ organizationId, agentId: agent.id, sessionId: current.id, text: answer, languageCode }),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
            throw new Error(payload.message ?? payload.error ?? `${provider} speech synthesis failed.`);
          }
          const audio = audioRef.current;
          if (!audio) throw new Error("Speech playback element is unavailable.");
          if (ttsObjectUrlRef.current) URL.revokeObjectURL(ttsObjectUrlRef.current);
          ttsObjectUrlRef.current = URL.createObjectURL(await response.blob());
          audio.srcObject = null;
          audio.src = ttsObjectUrlRef.current;
          audio.onended = () => {
            pipelineBusyRef.current = false;
            setSpeaking(false);
            streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !micMutedRef.current; });
            setNotice("Connected and listening.");
          };
          audio.onerror = () => {
            pipelineBusyRef.current = false;
            setSpeaking(false);
            setError(`${provider} audio playback failed.`);
            streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !micMutedRef.current; });
          };
          streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
          setSpeaking(true);
          await audio.play();
          return;
        }
        if (realtimeProviderRef.current === "gemini") {
          if (!("speechSynthesis" in window)) throw new Error("This browser does not support speech synthesis for Gemini Live responses.");
          const utterance = new SpeechSynthesisUtterance(answer);
          utterance.onstart = () => setSpeaking(true);
          utterance.onend = () => { setSpeaking(false); setNotice("Connected and listening."); };
          utterance.onerror = () => { setSpeaking(false); setError("Browser speech playback failed."); };
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
          return;
        }
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
      streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !micMutedRef.current; });
      pipelineBusyRef.current = false;
      const message = e instanceof Error ? e.message : "Voice turn failed.";
      setError(message);
      setTurns((old) => old.map((turn) => turn.id === assistantTurn.id ? { ...turn, text: message, state: "done" } : turn));
      setNotice("This turn failed. No external action is claimed as completed.");
    }
  }, [agent, organizationId]);

  function pcm16ToBase64(samples: Int16Array): string {
    const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
    }
    return btoa(binary);
  }

  function downsampleTo16k(input: Float32Array, inputRate: number): Int16Array {
    if (inputRate === 16000) {
      const sameRate = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) sameRate[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
      return sameRate;
    }
    const ratio = inputRate / 16000;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(Math.floor((i + 1) * ratio), input.length);
      let sum = 0;
      for (let j = start; j < end; j++) sum += input[j];
      const sample = end > start ? sum / (end - start) : 0;
      output[i] = Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 0x8000 : 0x7fff);
    }
    return output;
  }

  function pcm16ToWav(samples: Int16Array, sampleRate = 16000): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const write = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    write(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
    return new Blob([buffer], { type: "audio/wav" });
  }

  async function submitPipelineUtterance(samples: Int16Array[], current: VoiceSession, provider: "sarvam" | "elevenlabs") {
    if (pipelineBusyRef.current) return;
    pipelineBusyRef.current = true;
    const length = samples.reduce((total, part) => total + part.length, 0);
    if (!length) { pipelineBusyRef.current = false; return; }
    const merged = new Int16Array(length);
    let offset = 0;
    for (const part of samples) { merged.set(part, offset); offset += part.length; }
    try {
      const form = new FormData();
      form.append("organizationId", organizationId);
      form.append("agentId", agent?.id ?? "");
      form.append("sessionId", current.id);
      form.append("languageCode", languageCode);
      form.append("audio", pcm16ToWav(merged), "voice-utterance.wav");
      const response = await fetch("/api/voice/speech/transcribe", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({})) as { transcript?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? `${provider} speech recognition failed.`);
      const transcript = payload.transcript?.trim();
      if (transcript) await submitHostTurn(transcript, true);
      else pipelineBusyRef.current = false;
    } catch (e) {
      pipelineBusyRef.current = false;
      setError(e instanceof Error ? e.message : `${provider} speech recognition failed.`);
      setNotice("Speech turn failed; no email action is claimed as completed.");
    }
  }

  function finishProviderTts(generationId: string) {
    if (ttsGenerationRef.current !== generationId || !ttsFinalSeenRef.current || ttsPendingFramesRef.current > 0) return;
    ttsGenerationRef.current = null;
    pipelineBusyRef.current = false;
    setSpeaking(false);
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !micMutedRef.current; });
    setNotice("Connected and listening.");
  }

  function queueProviderPcmAudio(encodedAudio: string, sampleRate: number, generationId: string, isFinal: boolean) {
    if (ttsGenerationRef.current !== generationId) return;
    if (isFinal) ttsFinalSeenRef.current = true;
    if (encodedAudio) {
      try {
        const binary = atob(encodedAudio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
        if (samples.length) {
          const context = ttsAudioContextRef.current ?? new AudioContext();
          ttsAudioContextRef.current = context;
          const buffer = context.createBuffer(1, samples.length, sampleRate);
          const channel = buffer.getChannelData(0);
          for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          const startAt = Math.max(context.currentTime + 0.015, ttsNextStartRef.current);
          ttsNextStartRef.current = startAt + buffer.duration;
          ttsSourcesRef.current.add(source);
          ttsPendingFramesRef.current += 1;
          source.onended = () => {
            ttsSourcesRef.current.delete(source);
            ttsPendingFramesRef.current = Math.max(0, ttsPendingFramesRef.current - 1);
            finishProviderTts(generationId);
          };
          source.start(startAt);
        }
      } catch {
        setError("Provider audio chunk could not be decoded.");
      }
    }
    finishProviderTts(generationId);
  }

  async function connectProviderRealtime(current: VoiceSession, descriptor: Transport, provider: "sarvam" | "elevenlabs") {
    if (!descriptor.sessionEndpoint) throw new Error(`${provider} realtime session endpoint is not configured.`);
    if (!navigator.mediaDevices?.getUserMedia || typeof WebSocket === "undefined") {
      throw new Error("This browser does not support realtime microphone/WebSocket audio. Open the app over HTTPS in a supported browser.");
    }
    expectedDisconnectRef.current = false;
    activationStartedRef.current = false;
    realtimeProviderRef.current = provider;
    const response = await fetch(descriptor.sessionEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId, agentId: agent?.id, sessionId: current.id, languageCode }),
    });
    const payload = await response.json().catch(() => ({})) as { relayUrl?: string; ttsRelayUrl?: string; message?: string; error?: string };
    if (!response.ok || !payload.relayUrl) throw new Error(payload.message ?? payload.error ?? `${provider} realtime relay could not be initialized.`);

    const socket = new WebSocket(payload.relayUrl);
    providerSocketRef.current = socket;
    if (payload.ttsRelayUrl) {
      const ttsSocket = new WebSocket(payload.ttsRelayUrl);
      ttsSocketRef.current = ttsSocket;
      ttsSocket.onmessage = (event) => {
        let data: Record<string, unknown>;
        try { data = JSON.parse(String(event.data)) as Record<string, unknown>; } catch { return; }
        const type = String(data.type ?? "");
        if (type === "audio" && typeof data.audio === "string") {
          const generationId = typeof data.generationId === "string" ? data.generationId : "";
          const rate = Number(data.sampleRate) || (provider === "sarvam" ? 24000 : 16000);
          queueProviderPcmAudio(data.audio, rate, generationId, data.isFinal === true);
        } else if (type === "tts_event") {
          const eventType = String(data.eventType ?? "").toLowerCase();
          if (eventType.includes("complete") || eventType.includes("end")) {
            const generationId = typeof data.generationId === "string" ? data.generationId : "";
            if (generationId && ttsGenerationRef.current === generationId) {
              ttsFinalSeenRef.current = true;
              finishProviderTts(generationId);
            }
          }
        } else if (type === "error") {
          setError(typeof data.message === "string" ? data.message : `${provider} speech synthesis reported an error.`);
        }
      };
      ttsSocket.onerror = () => setError(`${provider} streaming speech output is unavailable; the host will try the provider's speech endpoint instead.`);
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    const audioContext = new AudioContext();
    geminiAudioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    geminiSourceRef.current = source;
    geminiProcessorRef.current = processor;
    source.connect(processor);
    processor.connect(audioContext.destination);
    processor.onaudioprocess = (event) => {
      if (micMutedRef.current || ttsGenerationRef.current || socket.readyState !== WebSocket.OPEN) return;
      const pcm = downsampleTo16k(event.inputBuffer.getChannelData(0), audioContext.sampleRate);
      if (!pcm.length) return;
      const audio = pcm16ToBase64(pcm);
      const frame = provider === "sarvam"
        ? { event: "audio_input", audio }
        : { message_type: "input_audio_chunk", audio_base_64: audio, sample_rate: 16000 };
      try { socket.send(JSON.stringify(frame)); } catch {}
    };

    const activate = () => {
      if (activationStartedRef.current) return;
      activationStartedRef.current = true;
      void patchSession({ action: "activate" }).then(() => {
        setConnected(true);
        setNotice(`${provider === "sarvam" ? "Sarvam Saaras" : "ElevenLabs Scribe"} realtime STT is connected. Spoken turns use Clara's authorized email runtime; answers stream through provider TTS when available.`);
      }).catch((e) => {
        activationStartedRef.current = false;
        setError(e instanceof Error ? e.message : "Could not persist the connected provider session.");
        stopMedia();
      });
    };

    socket.onmessage = (event) => {
      let data: Record<string, unknown>;
      try { data = JSON.parse(String(event.data)) as Record<string, unknown>; } catch { return; }
      const type = String(data.type ?? data.message_type ?? "");
      if ((type === "status" && data.value === "connected") || type === "session_started") activate();
      if (type === "transcript_partial" || type === "transcript_partial") {
        if (typeof data.text === "string" && data.text.trim()) setNotice(`Hearing: ${data.text.trim()}`);
      }
      if (type === "transcript_final") {
        const transcript = typeof data.text === "string" ? data.text.trim() : "";
        const now = Date.now();
        const previous = lastProviderFinalRef.current;
        if (transcript && !(previous?.text === transcript && now - previous.at < 1800)) {
          lastProviderFinalRef.current = { text: transcript, at: now };
          void submitHostTurn(transcript, true);
        }
      }
      if (type === "error") {
        const message = typeof data.message === "string" ? data.message : `${provider} realtime speech recognition failed.`;
        setError(message);
        if (data.fatal === true) {
          setConnected(false);
          stopMedia();
        }
      }
    };
    socket.onerror = () => setError(`${provider} realtime WebSocket failed. Check relay/provider configuration and reconnect.`);
    socket.onclose = () => {
      if (!expectedDisconnectRef.current) {
        setConnected(false);
        setError(`${provider} realtime connection closed unexpectedly.`);
        stopMedia();
      }
    };

    const deadline = Date.now() + 20_000;
    while (sessionRef.current?.status !== "active" && socket.readyState !== WebSocket.CLOSED && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (sessionRef.current?.status !== "active") throw new Error(`${provider} realtime session did not become ready before timeout.`);
  }

  async function connectSpeechPipeline(current: VoiceSession, provider: "sarvam" | "elevenlabs") {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      throw new Error("This browser does not support live microphone capture. Open the app over HTTPS in a supported browser.");
    }
    expectedDisconnectRef.current = false;
    realtimeProviderRef.current = provider;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    const audioContext = new AudioContext();
    geminiAudioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    geminiSourceRef.current = source;
    geminiProcessorRef.current = processor;
    source.connect(processor);
    processor.connect(audioContext.destination);
    processor.onaudioprocess = (event) => {
      if (pipelineBusyRef.current) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = downsampleTo16k(input, audioContext.sampleRate);
      if (!pcm.length) return;
      let energy = 0;
      for (let i = 0; i < input.length; i++) energy += input[i] * input[i];
      const rms = Math.sqrt(energy / Math.max(1, input.length));
      const now = Date.now();
      if (!pipelineSpeechStartedRef.current) {
        pipelinePreRollRef.current.push(pcm);
        if (pipelinePreRollRef.current.length > 3) pipelinePreRollRef.current.shift();
        if (rms >= 0.025) {
          pipelineSpeechStartedRef.current = true;
          pipelineLastVoiceAtRef.current = now;
          pipelineSamplesRef.current = [...pipelinePreRollRef.current];
          pipelinePreRollRef.current = [];
        }
      } else {
        pipelineSamplesRef.current.push(pcm);
        if (rms >= 0.025) pipelineLastVoiceAtRef.current = now;
        if (now - pipelineLastVoiceAtRef.current >= 750) {
          const utterance = pipelineSamplesRef.current;
          pipelineSamplesRef.current = [];
          pipelineSpeechStartedRef.current = false;
          pipelinePreRollRef.current = [];
          void submitPipelineUtterance(utterance, current, provider);
        }
      }
    };
    await patchSession({ action: "activate" });
    setConnected(true);
    setNotice(`${provider === "sarvam" ? "Sarvam Saaras" : "ElevenLabs Scribe"} microphone pipeline is ready. Speech is transcribed, processed by Clara's authorized runtime, then spoken using the selected provider.`);
  }

  async function connectGeminiRealtime(current: VoiceSession, descriptor: Transport) {
    if (!descriptor.sessionEndpoint) throw new Error("Gemini Live session endpoint is not configured.");
    if (!navigator.mediaDevices?.getUserMedia || typeof WebSocket === "undefined") {
      throw new Error("This browser does not support live microphone/WebSocket audio. Open the app over HTTPS in a supported browser.");
    }
    expectedDisconnectRef.current = false;
    realtimeProviderRef.current = "gemini";
    const tokenResponse = await fetch(descriptor.sessionEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId, agentId: agent?.id, sessionId: current.id }),
    });
    const tokenPayload = await tokenResponse.json().catch(() => ({})) as { ephemeralToken?: string; websocketUrl?: string; model?: string; message?: string; error?: string };
    if (!tokenResponse.ok || !tokenPayload.ephemeralToken || !tokenPayload.websocketUrl || !tokenPayload.model) {
      throw new Error(tokenPayload.message ?? tokenPayload.error ?? "Gemini Live could not issue a short-lived session token.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    const socketUrl = new URL(tokenPayload.websocketUrl);
    socketUrl.searchParams.set("access_token", tokenPayload.ephemeralToken);
    const socket = new WebSocket(socketUrl.toString());
    geminiSocketRef.current = socket;

    const audioContext = new AudioContext();
    geminiAudioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    geminiSourceRef.current = source;
    geminiProcessorRef.current = processor;
    source.connect(processor);
    processor.connect(audioContext.destination);
    processor.onaudioprocess = (event) => {
      if (micMuted || socket.readyState !== WebSocket.OPEN) return;
      const pcm = downsampleTo16k(event.inputBuffer.getChannelData(0), audioContext.sampleRate);
      if (!pcm.length) return;
      socket.send(JSON.stringify({
        realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: pcm16ToBase64(pcm) } },
      }));
    };

    socket.onopen = () => {
      socket.send(JSON.stringify({
        setup: {
          model: tokenPayload.model,
          generationConfig: { responseModalities: ["TEXT"] },
          inputAudioTranscription: {},
        },
      }));
      setNotice("Gemini Live WebSocket opened. Waiting for the provider's setup acknowledgement…");
    };
    socket.onmessage = (event) => {
      let data: Record<string, unknown>;
      try { data = JSON.parse(String(event.data)) as Record<string, unknown>; } catch { return; }
      if (data.setupComplete) {
        void patchSession({ action: "activate" }).then(() => {
          setConnected(true);
          setNotice("Gemini Live transcription is connected. Clara processes each recognized utterance through the authorized email/chat runtime.");
        }).catch((e) => {
          setError(e instanceof Error ? e.message : "Could not persist the connected Gemini session.");
          stopMedia();
        });
        return;
      }
      const serverContent = data.serverContent && typeof data.serverContent === "object" ? data.serverContent as Record<string, unknown> : null;
      const inputTranscription = serverContent?.inputTranscription && typeof serverContent.inputTranscription === "object"
        ? serverContent.inputTranscription as Record<string, unknown>
        : null;
      const recognized = typeof inputTranscription?.text === "string" ? inputTranscription.text : "";
      if (recognized) {
        geminiTranscriptRef.current += recognized;
        setNotice("Listening and transcribing with Gemini Live…");
      }
      if (serverContent?.turnComplete) {
        const finalText = geminiTranscriptRef.current.trim();
        geminiTranscriptRef.current = "";
        if (finalText) void submitHostTurn(finalText, true);
      }
      if (data.error) {
        const detail = data.error && typeof data.error === "object" ? (data.error as Record<string, unknown>).message : null;
        setError(typeof detail === "string" ? detail : "Gemini Live reported a realtime error.");
      }
    };
    socket.onerror = () => setError("Gemini Live WebSocket failed. Check provider access and reconnect.");
    socket.onclose = () => {
      if (!expectedDisconnectRef.current) {
        setConnected(false);
        setError("Gemini Live connection closed unexpectedly. Reconnect to continue.");
        stopMedia();
      }
    };

    const deadline = Date.now() + 20_000;
    while (!connected && socket.readyState !== WebSocket.CLOSED && Date.now() < deadline) {
      // setupComplete drives the persisted active state; the socket's readyState
      // alone is not treated as a connected voice session.
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (sessionRef.current?.status === "active") return;
    }
    if (sessionRef.current?.status !== "active") throw new Error("Gemini Live setup timed out before the session became ready.");
  }

  async function connectRealtime(current: VoiceSession, descriptor: Transport) {
    expectedDisconnectRef.current = false;
    realtimeProviderRef.current = "openai";
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
    const audio = audioRef.current;
    if (!audio) throw new Error("Realtime audio output element is unavailable.");
    audio.autoplay = true;
    audio.playsInline = true;
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
    setPendingApprovals([]);
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
        if (payload.transport.realtimeProvider === "openai") await connectRealtime(payload.session, payload.transport);
        else if (payload.transport.realtimeProvider === "gemini") await connectGeminiRealtime(payload.session, payload.transport);
        else throw new Error("This provider has not completed its native realtime transport integration.");
      } else if (payload.transport.transportMode === "pipeline" && (payload.transport.realtimeProvider === "sarvam" || payload.transport.realtimeProvider === "elevenlabs")) {
        await connectSpeechPipeline(payload.session, payload.transport.realtimeProvider);
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
    micMutedRef.current = next;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMicMuted(next);
    setNotice(next ? "Microphone muted. The realtime session remains connected." : "Microphone unmuted. Listening for speech.");
  }

  function interrupt() {
    if (realtimeProviderRef.current === "gemini") window.speechSynthesis?.cancel();
    if (realtimeProviderRef.current === "sarvam" || realtimeProviderRef.current === "elevenlabs") {
      audioRef.current?.pause();
      streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !micMutedRef.current; });
    }
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
      <audio ref={audioRef} autoPlay playsInline className="hidden" aria-hidden="true" />
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-primary"><Waves size={14} /> Clara voice workspace</p>
            <h1 className="mt-2 font-display text-3xl font-medium tracking-tight sm:text-4xl">Talk to your communication agent<span className="text-tertiary">.</span></h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A live conversation surface with explicit transport state, turn history, and host-authorized answers.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
              <span className="mr-3 text-xs text-muted-foreground">Agent</span>
              <select value={agentId} onChange={(e) => setAgentId(e.target.value)} disabled={liveSession} className="max-w-48 bg-transparent font-semibold outline-none">
                {agents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
              <span className="mr-3 text-xs text-muted-foreground">Speech language</span>
              <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} disabled={liveSession} className="bg-transparent font-semibold outline-none">
                <option value="en-IN">English (India)</option>
                <option value="ta-IN">Tamil</option>
                <option value="hi-IN">Hindi</option>
                <option value="bn-IN">Bengali</option>
                <option value="te-IN">Telugu</option>
                <option value="kn-IN">Kannada</option>
                <option value="ml-IN">Malayalam</option>
                <option value="mr-IN">Marathi</option>
                <option value="gu-IN">Gujarati</option>
                <option value="pa-IN">Punjabi</option>
                <option value="od-IN">Odia</option>
              </select>
            </label>
          </div>
        </header>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
          <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Radio size={16} className={connected ? "text-emerald-500" : "text-muted-foreground"} /> Live conversation</div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${connected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-border text-muted-foreground"}`}>
                {connected ? transport?.transportMode === "pipeline" ? "Voice ready" : "Connected" : busy ? "Connecting" : session?.status === "ended" || session?.status === "error" ? "Ended" : "Not connected"}
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
              {pendingApprovals.length ? (
                <section className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-left" aria-live="polite">
                  <p className="text-sm font-semibold">Email action approval required</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">These requests are queued for explicit approval. They have not sent, replied to, or forwarded any email.</p>
                  <ul className="mt-3 space-y-3">
                    {pendingApprovals.map((approval) => (
                      <li key={approval.actionId} className="rounded-xl border bg-background px-3 py-3">
                        <p className="text-sm font-medium">{approval.actionType.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{approval.message}</p>
                        <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">Approval ID: {approval.actionId}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
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
              {liveSession && bridgeOnly ? (
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
                <Row label="Transport" value={connected ? transport?.realtimeProvider === "gemini" ? "Gemini Live WebSocket" : transport?.realtimeProvider === "sarvam" ? "Sarvam STT/TTS pipeline" : transport?.realtimeProvider === "elevenlabs" ? "ElevenLabs STT/TTS pipeline" : "OpenAI WebRTC" : bridgeOnly ? "Authorized text bridge" : busy ? "Negotiating" : "Not connected"} />
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
                <Checklist label="Voice input/output path ready" checked={connected} />
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
