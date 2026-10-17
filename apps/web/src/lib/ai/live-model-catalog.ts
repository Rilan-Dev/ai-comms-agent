/**
 * Organization-scoped live model catalogue adapter.
 * Adapted from Clara-AI-Platform ai-governance/core/live-catalog.ts.
 * Only provider-advertised model IDs are returned. No hard-coded fallback IDs.
 * Endpoint origins are fixed to avoid turning encrypted provider keys into SSRF.
 */
export type LiveModelPurpose = "chat" | "embedding" | "realtime" | "tts" | "stt";
export type LiveModelProvider = "openai" | "gemini" | "sarvam" | "elevenlabs";
export type LiveModel = { id: string; name: string };

const SUPPORTED: Record<LiveModelProvider, readonly LiveModelPurpose[]> = {
  openai: ["chat", "embedding", "realtime", "tts", "stt"],
  gemini: ["chat", "embedding", "realtime"],
  sarvam: ["chat"],
  elevenlabs: ["tts", "stt"],
};

export function supportsLiveCatalog(provider: string, purpose: string): provider is LiveModelProvider {
  return Object.prototype.hasOwnProperty.call(SUPPORTED, provider) &&
    SUPPORTED[provider as LiveModelProvider].includes(purpose as LiveModelPurpose);
}

function clean(items: LiveModel[]): LiveModel[] {
  const unique = new Map<string, LiveModel>();
  for (const item of items) {
    const id = item.id?.trim();
    if (id && id.length <= 200) unique.set(id, { id, name: item.name?.trim() || id });
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json", ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Provider catalogue returned HTTP ${response.status}`);
  return response.json();
}

export async function fetchLiveModelCatalog(provider: LiveModelProvider, purpose: LiveModelPurpose, apiKey: string): Promise<LiveModel[]> {
  if (!supportsLiveCatalog(provider, purpose)) throw new Error("This provider does not publish a model-list API for that capability.");

  if (provider === "openai") {
    const payload = await getJson("https://api.openai.com/v1/models", { authorization: `Bearer ${apiKey}` }) as {
      data?: Array<{ id?: string }>;
    };
    const matches = (id: string): boolean => {
      const value = id.toLowerCase();
      if (purpose === "embedding") return value.includes("embedding");
      if (purpose === "realtime") return value.includes("realtime");
      if (purpose === "stt") return value.includes("transcribe") || value === "whisper-1";
      if (purpose === "tts") return /^tts-/.test(value) || value.includes("-tts");
      return /^(gpt-|o[1-9](?:-|$)|chatgpt-)/.test(value) &&
        !/(realtime|transcribe|embedding|-tts|audio|search|image)/.test(value);
    };
    return clean((payload.data ?? []).filter((m) => typeof m.id === "string" && matches(m.id)).map((m) => ({ id: m.id!, name: m.id! })));
  }

  if (provider === "gemini") {
    const models: LiveModel[] = [];
    let pageToken = "";
    for (let page = 0; page < 20; page++) {
      const qs = new URLSearchParams({ pageSize: "1000" });
      if (pageToken) qs.set("pageToken", pageToken);
      const payload = await getJson(`https://generativelanguage.googleapis.com/v1beta/models?${qs}`, {
        "x-goog-api-key": apiKey,
      }) as { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }>; nextPageToken?: string };
      for (const model of payload.models ?? []) {
        const id = model.name?.replace(/^models\//, "") ?? "";
        const methods = model.supportedGenerationMethods ?? [];
        const matched = purpose === "chat" ? methods.includes("generateContent")
          : purpose === "embedding" ? methods.includes("embedContent")
          : methods.some((method) => /bidi/i.test(method));
        if (id && matched) models.push({ id, name: model.displayName || id });
      }
      pageToken = payload.nextPageToken ?? "";
      if (!pageToken) return clean(models);
    }
    throw new Error("Gemini catalogue pagination limit reached; refusing a partial catalogue.");
  }

  if (provider === "sarvam") {
    const payload = await getJson("https://api.sarvam.ai/v2/models", {
      "api-subscription-key": apiKey,
    }) as { data?: Array<{ id?: string }> };
    // Clara's list includes beta V2-only models; ai-comms chat runtime currently
    // calls /v1/chat/completions. Do not offer models that cannot run there.
    const v1Models = new Set(["sarvam-105b", "sarvam-105b-conversations"]);
    return clean((payload.data ?? []).filter((m) => m.id && v1Models.has(m.id)).map((m) => ({ id: m.id!, name: m.id! })));
  }

  const payload = await getJson("https://api.elevenlabs.io/v1/models", {
    "xi-api-key": apiKey,
  }) as Array<{ model_id?: string; name?: string; can_do_text_to_speech?: boolean }>;
  if (!Array.isArray(payload)) throw new Error("ElevenLabs returned an invalid model catalogue.");
  return clean(payload.filter((m) => purpose === "tts"
    ? m.can_do_text_to_speech === true
    : typeof m.model_id === "string" && /^scribe[_-]/i.test(m.model_id))
    .map((m) => ({ id: m.model_id!, name: m.name || m.model_id! })));
}
