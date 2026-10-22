import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveProviderVoiceConfig } from "../src/lib/voice/resolve-provider-voice-config";

const session = readFileSync(new URL("../src/app/api/voice/session/route.ts", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../../packages/clara-core/src/runtime.ts", import.meta.url), "utf8");
const openaiOrganization = { organizationProvider: "openai", organizationModel: "gpt-realtime-2.1", organizationVoiceId: "nova" };

describe("voice provider config remains scoped to the selected provider", () => {
  it("cannot give Sarvam another provider's org model or voice", () => {
    expect(resolveProviderVoiceConfig({ provider: "sarvam", ...openaiOrganization })).toEqual({
      model: "saaras:v3-realtime", voiceId: "shubh",
    });
  });

  it("requires a distinct ElevenLabs voice instead of silently using OpenAI", () => {
    expect(resolveProviderVoiceConfig({ provider: "elevenlabs", ...openaiOrganization })).toEqual({
      model: "scribe_v2_realtime", voiceId: "",
    });
    expect(resolveProviderVoiceConfig({ provider: "elevenlabs", ...openaiOrganization, elevenLabsDefaultVoice: "voice-ok" }).voiceId).toBe("voice-ok");
  });

  it("never supplies OpenAI's voice or model to Gemini", () => {
    expect(resolveProviderVoiceConfig({ provider: "gemini", ...openaiOrganization })).toEqual({
      model: "gemini-3.5-transcribe-live", voiceId: "",
    });
  });

  it("respects same-provider org settings and explicit modern agent settings", () => {
    expect(resolveProviderVoiceConfig({
      provider: "sarvam", organizationProvider: "sarvam",
      organizationModel: "saaras:v4", organizationVoiceId: "priya",
    })).toEqual({ model: "saaras:v4", voiceId: "priya" });
    expect(resolveProviderVoiceConfig({
      provider: "sarvam", ...openaiOrganization, hasModernAgentSettings: true,
      agentSttModel: "saaras:v4", agentVoiceId: "ritu",
    })).toEqual({ model: "saaras:v4", voiceId: "ritu" });
  });

  it("rejects stale legacy models when the agent no longer uses that provider", () => {
    expect(resolveProviderVoiceConfig({
      provider: "sarvam", ...openaiOrganization, legacyAgentProvider: "openai",
      legacyAgentModel: "gpt-realtime-2.1", legacyAgentVoiceId: "alloy",
    })).toEqual({ model: "saaras:v3-realtime", voiceId: "shubh" });
    expect(resolveProviderVoiceConfig({
      provider: "openai", hasModernAgentSettings: true,
      legacyAgentProvider: "openai", legacyAgentModel: "legacy-old-model", legacyAgentVoiceId: "echo",
      organizationProvider: "openai", organizationModel: "gpt-realtime-2.1", organizationVoiceId: "nova",
    })).toEqual({ model: "gpt-realtime-2.1", voiceId: "nova" });
  });

  it("fails closed to valid Sarvam speaker and preserves provider-scoped overrides", () => {
    expect(resolveProviderVoiceConfig({
      provider: "sarvam", organizationProvider: "sarvam", organizationVoiceId: "alloy",
    }).voiceId).toBe("shubh");
    expect(resolveProviderVoiceConfig({
      provider: "openai", ...openaiOrganization, hasModernAgentSettings: true,
      agentSttModel: "gpt-realtime-2.1-mini", agentVoiceId: "echo",
    })).toEqual({ model: "gpt-realtime-2.1-mini", voiceId: "echo" });
  });

  it("host and Clara runtime cannot reintroduce cross-provider organization fallbacks", () => {
    expect(session).toContain("resolveProviderVoiceConfig({");
    expect(session).toContain('voiceProvider === "elevenlabs" && !voiceId');
    expect(runtime).toContain("organizationConfig?.voice?.provider === provider");
    expect(runtime).not.toContain('organizationConfig?.voice?.model || env("OPENAI_REALTIME_MODEL")');
    expect(runtime).not.toContain('organizationConfig?.voice?.voiceId || env("OPENAI_DEFAULT_VOICE")');
  });
});
