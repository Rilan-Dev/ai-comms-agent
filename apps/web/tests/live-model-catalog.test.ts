import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { documentedRealtimeModels, documentedSarvamVoiceModels, fetchLiveModelCatalog, hasDocumentedRealtimeModels, hasDocumentedSarvamVoiceModels, supportsLiveCatalog } from "../src/lib/ai/live-model-catalog";
import { providerConfigStatus } from "../src/lib/ai/provider-config-status";

function mockApi(handler: (url: string) => unknown) {
  const fetchMock = vi.fn(async (url: string) => {
    const result = handler(String(url));
    return { ok: true, json: async () => result };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("Live vendor model discovery", () => {
  it("filters OpenAI advertised IDs by actual capability, not a hard-coded list", async () => {
    const fetchMock = mockApi(() => ({
      data: [
        { id: "gpt-next-2026" }, { id: "gpt-realtime" },
        { id: "text-embedding-3-small" }, { id: "whisper-1" },
        { id: "tts-1" }, { id: "gpt-4o-audio-preview" }, { id: "gpt-next-2026" },
      ],
    }));
    expect((await fetchLiveModelCatalog("openai", "chat", "secret")).map((m) => m.id)).toEqual(["gpt-next-2026"]);
    expect((await fetchLiveModelCatalog("openai", "embedding", "secret")).map((m) => m.id)).toEqual(["text-embedding-3-small"]);
    expect((await fetchLiveModelCatalog("openai", "realtime", "secret")).map((m) => m.id)).toEqual(["gpt-realtime"]);
    expect((await fetchLiveModelCatalog("openai", "stt", "secret")).map((m) => m.id)).toEqual(["whisper-1"]);
    expect((await fetchLiveModelCatalog("openai", "tts", "secret")).map((m) => m.id)).toEqual(["tts-1"]);
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.objectContaining({ cache: "no-store", headers: expect.objectContaining({ authorization: "Bearer secret" }) }));
  });

  it("paginates Gemini catalog and uses supportedGenerationMethods", async () => {
    const fetchMock = mockApi((url) => url.includes("pageToken=page2")
      ? { models: [{ name: "models/gemini-live", displayName: "Gemini Live", supportedGenerationMethods: ["bidiGenerateContent"] }] }
      : {
          models: [
            { name: "models/gemini-chat", supportedGenerationMethods: ["generateContent"] },
            { name: "models/gemini-embedding", supportedGenerationMethods: ["embedContent"] },
          ],
          nextPageToken: "page2",
        });
    expect((await fetchLiveModelCatalog("gemini", "chat", "secret")).map((m) => m.id)).toEqual(["gemini-chat"]);
    expect((await fetchLiveModelCatalog("gemini", "embedding", "secret")).map((m) => m.id)).toEqual(["gemini-embedding"]);
    expect((await fetchLiveModelCatalog("gemini", "realtime", "secret")).map((m) => m.id)).toEqual(["gemini-live"]);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("pageToken=page2"))).toBe(true);
  });

  it("reads Sarvam vendor IDs but excludes V2-only models incompatible with current chat runtime", async () => {
    mockApi(() => ({ data: [{ id: "sarvam-105b-conversations" }, { id: "sarvam-105b" }, { id: "gemma4" }] }));
    expect((await fetchLiveModelCatalog("sarvam", "chat", "secret")).map((m) => m.id))
      .toEqual(["sarvam-105b", "sarvam-105b-conversations"]);
  });

  it("reads ElevenLabs TTS models and does not conflate them with Scribe STT", async () => {
    mockApi(() => [
      { model_id: "eleven_flash_v2_5", can_do_text_to_speech: true },
      { model_id: "scribe_v2", can_do_text_to_speech: false },
    ]);
    expect((await fetchLiveModelCatalog("elevenlabs", "tts", "secret")).map((m) => m.id)).toEqual(["eleven_flash_v2_5"]);
    expect((await fetchLiveModelCatalog("elevenlabs", "stt", "secret")).map((m) => m.id)).toEqual(["scribe_v2"]);
  });

  it("shows only app-supported, vendor-documented Sarvam TTS/STT rather than misleading live choices", () => {
    expect(supportsLiveCatalog("sarvam", "tts")).toBe(false);
    expect(supportsLiveCatalog("sarvam", "stt")).toBe(false);
    expect(hasDocumentedSarvamVoiceModels("sarvam", "tts")).toBe(true);
    expect(hasDocumentedSarvamVoiceModels("sarvam", "stt")).toBe(true);
    expect(documentedSarvamVoiceModels("sarvam", "tts").map(model => model.id)).toEqual(["bulbul:v3"]);
    expect(documentedSarvamVoiceModels("sarvam", "stt").map(model => model.id)).toEqual(["saaras:v4"]);
    expect(documentedSarvamVoiceModels("sarvam", "chat")).toEqual([]);
    expect(documentedSarvamVoiceModels("elevenlabs", "stt")).toEqual([]);
    expect(documentedSarvamVoiceModels("sarvam", "realtime")).toEqual([]);
  });

  it("offers documented Sarvam streaming STT models without claiming a live vendor catalogue", () => {
    expect(supportsLiveCatalog("sarvam", "realtime")).toBe(false);
    expect(hasDocumentedRealtimeModels("sarvam", "realtime")).toBe(true);
    expect(documentedRealtimeModels("sarvam", "realtime").map((model) => model.id))
      .toEqual(["saaras:v3-realtime", "saaras:v4"]);
  });

  it("maps ElevenLabs streaming STT to Scribe, not a Conversational AI agent", () => {
    expect(hasDocumentedRealtimeModels("elevenlabs", "realtime")).toBe(true);
    expect(documentedRealtimeModels("elevenlabs", "realtime").map((model) => model.id))
      .toEqual(["scribe_v2_realtime"]);
    expect(documentedRealtimeModels("elevenlabs", "realtime").some((model) => model.id === "elevenlabs-conversational")).toBe(false);
  });

  it("rejects unsupported catalogues and never falls back after vendor errors", async () => {
    expect(supportsLiveCatalog("sarvam", "tts")).toBe(false);
    expect(supportsLiveCatalog("tei", "embedding")).toBe(false);
    await expect(fetchLiveModelCatalog("sarvam", "tts", "secret")).rejects.toThrow("does not publish");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(fetchLiveModelCatalog("openai", "chat", "secret")).rejects.toThrow("HTTP 503");
  });
});

describe("model catalog boundary contracts", () => {
  it("drops stale organization model responses and requires fresh provider configuration", () => {
    const select = read("../src/components/live-model-select.tsx");
    const json = select.indexOf("const body = await response.json()");
    const aborted = select.indexOf("if (controller.signal.aborted) return;", json);
    const apply = select.indexOf("setModels(body.models ?? [])", json);
    expect(json).toBeGreaterThanOrEqual(0);
    expect(aborted).toBeGreaterThan(json);
    expect(apply).toBeGreaterThan(aborted);
    const setup = read("../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx");
    const chatProviders = read("../src/app/settings/ai-provider-settings.tsx");
    for (const source of [setup, chatProviders]) {
      expect(source).toContain('setLoadedOrganizationId("");');
      expect(source).toContain('setApiKey("");');
      expect(source).toContain("currentOrganizationId.current !== organizationId");
      expect(source).toContain("return () => controller.abort()");
      expect(source).toContain("if (!organizationReady)");
    }
  });

  const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

  it("authorizes organization before reading decrypted credentials and never serves static fallback", () => {
    const route = read("../src/app/api/settings/ai-models/route.ts");
    expect(route).toContain('permission: "organization.read"');
    expect(route.indexOf("await authorize")).toBeLessThan(route.indexOf("await getDecryptedProviderConfig"));
    expect(route).toContain('source: "live"');
    expect(route).not.toContain("getStaticModels");
    expect(route).not.toContain("process.env.OPENAI_API_KEY");
  });

  it("configures independent TTS and STT purpose models and uses live agent selectors", () => {
    const setup = read("../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx");
    const agent = read("../src/app/agents/[id]/agent-ai-settings-panel.tsx");
    const selector = read("../src/components/live-model-select.tsx");
    expect(setup).toContain('model: purpose === "stt" ? sttModel : model');
    expect(setup).toContain("LiveModelSelect");
    expect((agent.match(/<LiveModelSelect/g) ?? []).length).toBe(6);
    expect(selector).toContain("/api/settings/ai-models?");
    expect(selector).toContain("source !== \"live\"");
    expect(selector).not.toContain("static_");
  });
});

describe("realtime voice selection and relay integration", () => {
  it("authorizes org credentials before returning documented options", () => {
    const route = readFileSync(resolve(__dirname, "../src/app/api/settings/ai-models/route.ts"), "utf8");
    expect(route.indexOf("await authorize")).toBeLessThan(route.indexOf("await getDecryptedProviderConfig"));
    expect(route.indexOf("await getDecryptedProviderConfig")).toBeLessThan(route.indexOf("hasDocumentedRealtimeModels(provider, purpose)) {"));
    expect(route).toContain('source: "documented"');
    expect(route).toContain('capability: "streaming_stt"');
    expect(route).toContain("Cache-Control");
  });

  it("does not accept legacy conversational markers on realtime provider saves", () => {
    const route = readFileSync(resolve(__dirname, "../src/app/api/settings/ai-provider-configs/route.ts"), "utf8");
    expect(route).toContain("unsupported_realtime_model");
    expect(route).toContain("documentedRealtimeModels(provider, purpose).some");
  });

  it("uses the configured model through the authenticated session and relay", () => {
    const session = readFileSync(resolve(__dirname, "../src/app/api/voice/session/route.ts"), "utf8");
    const resolver = readFileSync(resolve(__dirname, "../../../packages/agent-core/src/runtime.ts"), "utf8");
    const relay = readFileSync(resolve(__dirname, "../src/lib/voice/provider-relay-init.ts"), "utf8");
    expect(session).toContain("purpose='realtime' AND enabled=true");
    expect(session).toContain("providerModelResult.rows[0]?.model");
    expect(resolver).toContain('model === "saaras:v4" || model === "saaras:v3-realtime"');
    expect(relay).toContain('selectedModel === "saaras:v4" || selectedModel === "saaras:v3-realtime"');
    expect(relay).toContain('sttModel: "scribe_v2_realtime"');
  });

  it("differentiates documented STT modes from actual live provider catalogue UI", () => {
    const selector = readFileSync(resolve(__dirname, "../src/components/live-model-select.tsx"), "utf8");
    const setup = readFileSync(resolve(__dirname, "../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx"), "utf8");
    expect(selector).toContain('body.source !== "live" && body.source !== "documented"');
    expect(selector).toContain('catalogSource === "documented"');
    expect(selector).toContain("Previously saved model");
    expect(setup).toContain("Realtime speech-recognition model");
    expect(setup).toContain("not ElevenLabs Conversational AI agents");
    expect(setup).toContain('savedKeyStatus === "active" ? "Credentials enabled"');
    expect(setup).toContain("A saved key does not guarantee a live session.");
  });
});

describe("provider-setup safety and truthful status", () => {
  it("requires both voice-chat capabilities before marking a provider active", () => {
    const tts = { provider: "elevenlabs", purpose: "tts", enabled: true, hasApiKey: true };
    const stt = { provider: "elevenlabs", purpose: "stt", enabled: true, hasApiKey: true };
    expect(providerConfigStatus([tts], "elevenlabs", ["tts", "stt"])).toBe("incomplete");
    expect(providerConfigStatus([tts, stt], "elevenlabs", ["tts", "stt"])).toBe("active");
    expect(providerConfigStatus([tts, { ...stt, enabled: false }], "elevenlabs", ["tts", "stt"])).toBe("saved (disabled)");
  });

  it("clears a typed secret on provider switch and checks failed deletion before success UI", () => {
    const setup = readFileSync(resolve(__dirname, "../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx"), "utf8");
    const choose = setup.slice(setup.indexOf("function chooseProvider(next: string)"), setup.indexOf("async function saveProvider()"));
    const remove = setup.slice(setup.indexOf("async function deleteProvider()"));
    expect(choose).toContain('setApiKey("");');
    expect(setup).toContain("onClick={() => chooseProvider(p)}");
    expect(setup).toContain('onClick={() => chooseProvider("")}');
    expect(remove).toContain("if (!response.ok)");
    expect(remove.indexOf("if (!response.ok)")).toBeLessThan(remove.indexOf('setNotice("Provider config removed.")'));
    expect(remove).toContain("setCatalogVersion((n) => n + 1)");
  });
});
