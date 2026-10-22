import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveAgentRealtimeVoiceProvider } from "../src/lib/voice/resolve-agent-realtime-provider";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const session = source("../src/app/api/voice/session/route.ts");
const settingsApi = source("../src/app/api/agents/[id]/ai-settings/route.ts");
const clara = source("../../../packages/clara-core/src/runtime.ts");
const browser = source("../src/app/ai-voice/voice-workspace.tsx");

describe("per-agent realtime voice provider selection", () => {
  it("prefers explicitly saved Sarvam override to a legacy OpenAI agent value and org default", () => {
    expect(resolveAgentRealtimeVoiceProvider({
      agentSettings: { realtimeVoiceProviderOverride: "sarvam" },
      legacyAgentVoiceProvider: "openai",
      organizationRealtimeVoiceProvider: "openai",
      environmentRealtimeVoiceProvider: "openai",
    })).toBe("sarvam");
  });

  it("honors explicit inherit (null) rather than a stale legacy OpenAI provider", () => {
    expect(resolveAgentRealtimeVoiceProvider({
      agentSettings: { realtimeVoiceProviderOverride: null },
      legacyAgentVoiceProvider: "openai",
      organizationRealtimeVoiceProvider: "sarvam",
      environmentRealtimeVoiceProvider: "openai",
    })).toBe("sarvam");
  });

  it("preserves legacy agent configurations only when modern AI Settings do not exist", () => {
    expect(resolveAgentRealtimeVoiceProvider({
      agentSettings: null,
      legacyAgentVoiceProvider: "gemini",
      organizationRealtimeVoiceProvider: "openai",
      environmentRealtimeVoiceProvider: "sarvam",
    })).toBe("gemini");
  });

  it("never silently falls back to OpenAI when Sarvam was explicitly selected", () => {
    expect(resolveAgentRealtimeVoiceProvider({
      agentSettings: { realtimeVoiceProviderOverride: " Sarvam " },
      legacyAgentVoiceProvider: null,
      organizationRealtimeVoiceProvider: null,
      environmentRealtimeVoiceProvider: "openai",
    })).toBe("sarvam");
    expect(resolveAgentRealtimeVoiceProvider({
      agentSettings: { realtimeVoiceProviderOverride: "unsupported" },
      legacyAgentVoiceProvider: null,
      organizationRealtimeVoiceProvider: "openai",
      environmentRealtimeVoiceProvider: "openai",
    })).toBe("unsupported");
  });

  it("reads the same org/agent-scoped AI settings the UI saves and refuses unsupported providers", () => {
    expect(settingsApi).toContain("realtimeVoiceProviderOverride: toNullableString(body.realtimeVoiceProviderOverride)");
    expect(session).toContain("getAgentAiSettings(organizationId, agentId)");
    expect(session).toContain("agentSettings: agentAiSettings");
    expect(session).toContain("resolveAgentRealtimeVoiceProvider({");
    expect(session).toContain('error: "voice_provider_unsupported"');
    expect(session).toContain("voiceOverride: { provider: voiceProvider, model: voiceModel, voiceId }");
    expect(session).not.toContain('const voiceProvider = agentVoiceRow?.voice_provider?.trim() ||');
  });

  it("does not reuse another provider's model or stale agent voice when modern settings exist", () => {
    expect(session).toContain("orgVoiceProvider === voiceProvider");
    expect(session).toContain("agentAiSettings?.realtimeSttModel?.trim()");
    expect(session).toContain("agentAiSettings?.realtimeVoiceIdOverride?.trim()");
    expect(session).toContain('agentAiSettings === null ? agentVoiceRow?.voice_model?.trim() || "" : ""');
  });

  it("keeps Sarvam on its own host-authorized native relay or speech pipeline", () => {
    expect(clara).toContain('provider === "sarvam" ? "/api/voice/sarvam/session"');
    expect(clara).toContain('transportMode: "pipeline" as const');
    expect(browser).toContain('payload.transport.realtimeProvider === "sarvam" || payload.transport.realtimeProvider === "elevenlabs"');
    expect(browser).toContain("connectProviderRealtime(payload.session, payload.transport, payload.transport.realtimeProvider)");
    expect(browser).toContain("connectSpeechPipeline(payload.session, payload.transport.realtimeProvider)");
    expect(browser).toContain('if (payload.transport.realtimeProvider === "openai") await connectRealtime');
  });
});
