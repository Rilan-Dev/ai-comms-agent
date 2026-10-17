import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchLiveModelCatalog, supportsLiveCatalog } from "../src/lib/ai/live-model-catalog";

function mockApi(handler: (url: string) => unknown) {
  const fetchMock = vi.fn(async (url: string) => {
    const result = handler(String(url));
    return { ok: true, json: async () => result };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("Clara-style live vendor model discovery", () => {
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

  it("rejects unsupported catalogues and never falls back after vendor errors", async () => {
    expect(supportsLiveCatalog("sarvam", "tts")).toBe(false);
    expect(supportsLiveCatalog("tei", "embedding")).toBe(false);
    await expect(fetchLiveModelCatalog("sarvam", "tts", "secret")).rejects.toThrow("does not publish");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(fetchLiveModelCatalog("openai", "chat", "secret")).rejects.toThrow("HTTP 503");
  });
});

describe("model catalog boundary contracts", () => {
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
