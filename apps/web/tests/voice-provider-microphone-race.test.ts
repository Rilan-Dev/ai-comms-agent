import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';

// Exercise the actual component connector with browser boundaries replaced.
// No provider traffic, microphone, React rendering, or duplicated state machine.
const source = readFileSync(new URL('../src/app/ai-voice/voice-workspace.tsx', import.meta.url), 'utf8');
const connector = source.slice(source.indexOf('async function connectProviderRealtime('), source.indexOf('async function connectSpeechPipeline('));
const javascript = ts.transpileModule(connector, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

async function harness(options: { deferOutput?: boolean } = {}) {
  const sockets: Socket[] = [];
  class Socket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 1;
    onmessage: ((event: { data: string }) => void) | null = null;
    constructor(_url: string) { sockets.push(this); }
    send = vi.fn();
    connected() { this.onmessage?.({ data: JSON.stringify({ type: 'status', value: 'connected' }) }); }
  }
  let resumeRequested!: () => void;
  let releaseOutput!: () => void;
  const outputRequested = new Promise<void>(resolve => { resumeRequested = resolve; });
  const outputResume = new Promise<void>(resolve => { releaseOutput = resolve; });
  let release!: (value: object) => void;
  let permissionRequested!: () => void;
  const requested = new Promise<void>(resolve => { permissionRequested = resolve; });
  const permission = new Promise<object>(resolve => { release = resolve; });
  const sessionRef = { current: { id: 'session', status: 'starting' } };
  const patchSession = vi.fn(async () => { sessionRef.current.status = 'active'; });
  const ref = () => ({ current: null });
  const bindings = {
    navigator: { mediaDevices: { getUserMedia: vi.fn(() => { permissionRequested(); return permission; }) } },
    WebSocket: Socket,
    AudioContext: class {
      sampleRate = 48000;
      destination = {};
      async resume() { if (options.deferOutput) { resumeRequested(); await outputResume; } }
      async close() {}
      createMediaStreamSource() { return { connect() {} }; }
      createScriptProcessor() { return { connect() {}, onaudioprocess: null }; }
    },
    fetch: async () => ({ ok: true, json: async () => ({ relayUrl: 'wss://test/stt', ttsRelayUrl: 'wss://test/tts' }) }),
    expectedDisconnectRef: { current: false }, activationStartedRef: { current: false }, realtimeProviderRef: ref(),
    providerSocketRef: ref(), ttsSocketRef: ref(), ttsAudioContextRef: ref(), streamRef: ref(),
    geminiAudioContextRef: ref(), geminiSourceRef: ref(), geminiProcessorRef: ref(),
    micMutedRef: { current: false }, abortRef: { current: null as AbortController | null }, ttsGenerationRef: ref(), ttsFinalSeenRef: ref(), lastProviderFinalRef: ref(),
    organizationId: 'organization', agent: { id: 'agent' }, languageCode: 'en-IN', sessionRef,
    patchSession, setConnected: vi.fn(), setNotice: vi.fn(), setError: vi.fn(), stopMedia: vi.fn(),
    streamProviderTts: vi.fn(), queueProviderPcmAudio: vi.fn(), finishProviderTts: vi.fn(),
    reportUnexpectedTransportLoss: vi.fn(), submitHostTurn: vi.fn(), interrupt: vi.fn(),
    downsampleTo16k: () => new Int16Array([1]), pcm16ToBase64: () => "AA==",
    // Advance only the connector readiness deadline, without a 20-second wait.
    Date: { now: (() => { let now = 0; return () => now += 21000; })() },
  };
  const connect = new Function(...Object.keys(bindings), `${javascript}; return connectProviderRealtime;`)(...Object.values(bindings));
  const result = connect(sessionRef.current, { sessionEndpoint: '/session' }, 'sarvam');
  await (options.deferOutput ? outputRequested : requested);
  return { sockets, release, releaseOutput, result, patchSession, bindings };
}

describe('provider readiness while microphone permission is pending', () => {
  it('retains both upstream connection statuses received before microphone permission resolves', async () => {
    const h = await harness();
    h.sockets[0]!.connected();
    h.sockets[1]!.connected();
    expect(h.patchSession).not.toHaveBeenCalled();
    h.release({});
    await expect(h.result).resolves.toBeUndefined();
    expect(h.patchSession).toHaveBeenCalledTimes(1);
    expect(h.bindings.streamProviderTts).toHaveBeenCalledTimes(1);
  });
  it('does not activate with microphone and STT alone', async () => {
    const h = await harness();
    h.sockets[0]!.connected();
    h.release({});
    await expect(h.result).rejects.toThrow('did not become ready');
    expect(h.patchSession).not.toHaveBeenCalled();
  });
});

describe('Sarvam duplex interruption', () => {
  it('keeps capture running during output but honors explicit mute', async () => {
    const h = await harness();
    h.sockets.forEach(s => s.connected());
    h.release({});
    await h.result;
    h.bindings.ttsGenerationRef.current = 'answer' as never;
    const processor = h.bindings.geminiProcessorRef.current as unknown as { onaudioprocess: (event: object) => void };
    const event = { inputBuffer: { getChannelData: () => new Float32Array([0.1]) } };
    processor.onaudioprocess(event);
    expect(h.sockets[0]!.send).toHaveBeenCalledTimes(1);
    h.bindings.micMutedRef.current = true;
    processor.onaudioprocess(event);
    expect(h.sockets[0]!.send).toHaveBeenCalledTimes(1);
  });
  it('interrupts current output on VAD or nonempty partial, ignoring stale sockets and muted input', async () => {
    const h = await harness();
    h.sockets.forEach(s => s.connected()); h.release({}); await h.result;
    h.bindings.ttsGenerationRef.current = 'answer' as never;
    const send = (data: object) => h.sockets[0]!.onmessage!({ data: JSON.stringify(data) });
    send({ type: 'vad_speech_start' });
    send({ type: 'transcript_partial', text: 'Actually wait' });
    expect(h.bindings.interrupt).toHaveBeenCalledTimes(2);
    h.bindings.micMutedRef.current = true;
    send({ type: 'vad_speech_start' });
    expect(h.bindings.interrupt).toHaveBeenCalledTimes(2);
    h.bindings.micMutedRef.current = false;
    h.bindings.providerSocketRef.current = null;
    send({ type: 'vad_speech_start' });
    expect(h.bindings.interrupt).toHaveBeenCalledTimes(2);
  });
});

function boundFunction(start: string, end: string, name: string, bindings: Record<string, unknown>) {
  const code = ts.transpileModule(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), `${code}; return ${name};`)(...Object.values(bindings));
}
it('Sarvam output leaves microphone live unless explicitly muted', () => {
  for (const [provider, muted, enabled] of [['sarvam', false, true], ['sarvam', true, false], ['elevenlabs', false, false]] as const) {
    const track = { enabled: true };
    const bindings = { ttsSocketRef: { current: { readyState: 1, send: vi.fn() } }, WebSocket: { OPEN: 1 },
      ttsGenerationRef: {}, ttsFinalSeenRef: {}, ttsPendingFramesRef: {}, ttsNextStartRef: {},
      ttsAudioContextRef: { current: { currentTime: 0 } }, streamRef: { current: { getAudioTracks: () => [track] } },
      realtimeProviderRef: { current: provider }, micMutedRef: { current: muted }, setSpeaking: vi.fn(), setNotice: vi.fn() };
    const start = boundFunction('function streamProviderTts(', 'function speakGeminiWelcome(', 'streamProviderTts', bindings);
    start('Hello', 'generation');
    expect(track.enabled).toBe(enabled);
  }
});
it('interrupt invalidates old host stream before stopping output', () => {
  const sequence = { current: 7 };
  const abort = vi.fn();
  const bindings = { turnSequenceRef: sequence, abortRef: { current: { abort } }, realtimeProviderRef: { current: 'sarvam' },
    ttsSocketRef: { current: { readyState: 1, send: vi.fn() } }, WebSocket: { OPEN: 1 }, ttsGenerationRef: { current: 'old' },
    ttsSourcesRef: { current: new Set() }, ttsPendingFramesRef: {}, ttsFinalSeenRef: {}, pipelineBusyRef: {},
    ttsIdleTimerRef: {}, audioRef: {}, streamRef: {}, channelRef: {}, setSpeaking: vi.fn(), setNotice: vi.fn() };
  const stop = boundFunction('function interrupt()', 'const liveSession =', 'interrupt', bindings);
  stop();
  expect(abort).toHaveBeenCalledTimes(1);
  expect(sequence.current).toBe(8);
  // The existing SSE loop checks this sequence before each delta/done; the
  // next real utterance increments again instead of reviving the cancelled one.
  expect(source).toContain('if (!isCurrentVoiceSequence(turnSequenceRef.current, sequence) || controller.signal.aborted) return;');
  expect(source).toContain('const sequence = ++turnSequenceRef.current;');
});

it('late events from a replaced call cannot submit another host turn or terminate the new call', async () => {
  const h = await harness();
  h.sockets.forEach(s => s.connected()); h.release({}); await h.result;
  h.bindings.sessionRef.current = { id: 'replacement-session', status: 'starting' };
  h.sockets[0]!.onmessage!({ data: JSON.stringify({ type: 'transcript_final', text: 'old audio' }) });
  expect(h.bindings.submitHostTurn).not.toHaveBeenCalled();
  (h.sockets[1] as unknown as { onclose: () => void }).onclose();
  expect(h.bindings.reportUnexpectedTransportLoss).not.toHaveBeenCalled();
});

it('late SSE tokens and completion cannot restart speech after interrupt; a new turn still works', async () => {
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const sequence = { current: 0 };
  const abortRef = { current: null as AbortController | null };
  const speak = vi.fn(() => true);
  const pendingApprovals = vi.fn();
  const shared = { turnSequenceRef: sequence, abortRef, realtimeProviderRef: { current: 'sarvam' },
    ttsSocketRef: { current: { readyState: 1, send: vi.fn() } }, WebSocket: { OPEN: 1 }, ttsGenerationRef: { current: null },
    ttsSourcesRef: { current: new Set() }, ttsPendingFramesRef: {}, ttsFinalSeenRef: {}, pipelineBusyRef: {},
    ttsIdleTimerRef: {}, audioRef: {}, streamRef: {}, channelRef: {}, setSpeaking: vi.fn(), setNotice: vi.fn() };
  const bindings = { ...shared, useCallback: (fn: unknown) => fn, agent: { id: 'agent' }, organizationId: 'org',
    sessionRef: { current: { id: 'session' } }, AbortController, setTurns: vi.fn(), setVoiceActivitySteps: vi.fn(),
    fetch: async () => ({ ok: true, body: {} }), setError: vi.fn(), setPendingApprovals: pendingApprovals,
    isCurrentVoiceSequence: (current: number, expected: number) => current === expected,
    streamProviderTts: speak,
    readSseEvents: async function* () { started(); await delayed;
      yield { event: 'delta', data: JSON.stringify({ text: 'Old answer' }) };
      yield { event: 'done', data: '{}' };
    },
  };
  const submit = boundFunction('const submitHostTurn = useCallback(', 'function pcm16ToBase64(', 'submitHostTurn', bindings);
  const stop = boundFunction('function interrupt()', 'const liveSession =', 'interrupt', shared);
  const first = submit('First request', true);
  await waiting;
  stop(); release(); await first;
  expect(speak).not.toHaveBeenCalled();
  expect(pendingApprovals).not.toHaveBeenCalled();
  await submit('New request', true);
  expect(speak).toHaveBeenCalledTimes(1);
  expect(sequence.current).toBe(3);
});

it('stops a microphone granted after the call was replaced without installing capture', async () => {
  const h = await harness();
  h.bindings.sessionRef.current = { id: 'replacement', status: 'starting' };
  const stop = vi.fn();
  h.release({ getTracks: () => [{ stop }] });
  await h.result;
  expect(stop).toHaveBeenCalledTimes(1);
  expect(h.bindings.streamRef.current).toBeNull();
  expect(h.bindings.geminiProcessorRef.current).toBeNull();
  expect(h.patchSession).not.toHaveBeenCalled();
});

it('speech-start interrupts a pending host response before audio begins but ignores idle VAD', async () => {
  const h = await harness();
  h.sockets.forEach(s => s.connected()); h.release({}); await h.result;
  const send = () => h.sockets[0]!.onmessage!({ data: JSON.stringify({ type: 'vad_speech_start' }) });
  h.bindings.ttsGenerationRef.current = null;
  send(); expect(h.bindings.interrupt).not.toHaveBeenCalled();
  h.bindings.abortRef.current = new AbortController();
  send(); expect(h.bindings.interrupt).toHaveBeenCalledTimes(1);
});

it('a stopped older audio source cannot decrement the replacement generation pending frames', () => {
  let ended!: () => void;
  const oldSource = { connect() {}, start() {}, buffer: null, set onended(fn: () => void) { ended = fn; } };
  const generation = { current: 'old' };
  const pending = { current: 0 };
  const finish = vi.fn();
  const context = { currentTime: 0, destination: {}, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }), createBufferSource: () => oldSource };
  const bindings = { ttsGenerationRef: generation, ttsFinalSeenRef: { current: false }, ttsPendingFramesRef: pending,
    ttsIdleTimerRef: { current: null }, ttsAudioContextRef: { current: context }, ttsNextStartRef: { current: 0 },
    ttsSourcesRef: { current: new Set() }, finishProviderTts: finish, setError: vi.fn(), atob,
    setTimeout: () => 1, clearTimeout: vi.fn() };
  const queue = boundFunction('function queueProviderPcmAudio(', 'async function connectProviderRealtime(', 'queueProviderPcmAudio', bindings);
  queue('AAA=', 24000, 'old', false);
  expect(pending.current).toBe(1);
  generation.current = 'new'; pending.current = 3; finish.mockClear();
  ended();
  expect(pending.current).toBe(3);
  expect(finish).not.toHaveBeenCalled();
});

it('does not open another socket or request microphone after a stopped output-context resume', async () => {
  const h = await harness({ deferOutput: true });
  h.bindings.expectedDisconnectRef.current = true;
  h.releaseOutput(); await h.result;
  expect(h.sockets).toHaveLength(1);
  expect(h.bindings.navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  expect(h.bindings.ttsAudioContextRef.current).toBeNull();
});

it('a rejected old activation request cannot stop a replacement call', async () => {
  const h = await harness();
  h.bindings.Date.now = () => 0;
  let reject!: (error: Error) => void;
  h.patchSession.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  h.sockets.forEach(s => s.connected()); h.release({});
  await vi.waitFor(() => expect(h.patchSession).toHaveBeenCalledTimes(1));
  h.bindings.sessionRef.current = { id: 'replacement', status: 'active' };
  reject(new Error('Old activation failed'));
  await h.result;
  expect(h.bindings.stopMedia).not.toHaveBeenCalled();
  expect(h.bindings.setError).not.toHaveBeenCalled();
});
