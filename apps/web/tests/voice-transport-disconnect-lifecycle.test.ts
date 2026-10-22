import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/app/ai-voice/voice-workspace.tsx", import.meta.url), "utf8");
const provider = source.slice(source.indexOf("async function connectProviderRealtime("), source.indexOf("async function connectSpeechPipeline("));
const gemini = source.slice(source.indexOf("async function connectGeminiRealtime("), source.indexOf("async function connectRealtime("));
const openai = source.slice(source.indexOf("async function connectRealtime("), source.indexOf("async function start()"));
const teardown = source.slice(source.indexOf("const reportUnexpectedTransportLoss ="), source.indexOf("function streamProviderTts("));
const patch = source.slice(source.indexOf("const patchSession ="), source.indexOf("const maybeActivate ="));

describe("FIX-01 realtime transport unexpected loss host lifecycle", () => {
  it("persists unexpected disconnect on host instead of leaving an active orphaned voice session", () => {
    expect(teardown).toContain("expectedDisconnectRef.current");
    expect(teardown).toContain("transportFailureInFlightRef.current");
    expect(teardown).toContain("const active = sessionRef.current");
    expect(teardown).toContain("stopMedia()");
    expect(teardown).toContain('fetch("/api/voice/session"');
    expect(teardown).toContain('method: "DELETE"');
    expect(teardown).toContain('reason: "transport_lost"');
    expect(teardown).toContain('payload?.session?.id !== active.id');
    expect(teardown).toContain('payload.session.status !== "ended"');
    expect(teardown).toContain("sessionRef.current?.id === active.id");
    expect(teardown).toContain("setSession(payload.session)");
    expect(teardown).toContain("Host voice termination is not confirmed");
  });

  it("reports Gemini and native relay unexpected close and fatal provider error", () => {
    expect(provider).toContain('void reportUnexpectedTransportLoss(');
    expect(gemini).toContain('void reportUnexpectedTransportLoss(');
    expect(provider).toContain('if (data.fatal === true)');
    expect(provider).not.toContain('if (data.fatal === true) {\n          setConnected(false);\n          stopMedia();');
  });

  it("terminates irrecoverable OpenAI WebRTC failure without confusing a transient disconnected state", () => {
    expect(openai).toContain('pc.connectionState === "failed" || pc.connectionState === "closed"');
    expect(openai).toContain("void reportUnexpectedTransportLoss(");
    expect(openai).toContain('pc.connectionState === "disconnected"');
  });

  it("does not reactivate an already torn down socket from a late PATCH response", () => {
    expect(patch).toContain('body.action === "activate" && expectedDisconnectRef.current');
    expect(patch).toContain("throw new Error");
    const startup = source.slice(source.indexOf("async function start()"), source.indexOf("async function sendTextTurn()"));
    expect(startup).toContain('reason: "transport_start_failed"');
    expect(startup).toContain('payload.session.status !== "ended"');
    expect(startup).not.toContain('setSession((current) => current ? { ...current, status: "error" } : null)');
  });
});
