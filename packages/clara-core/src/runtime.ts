import { decryptCredential, parseCredentialsMasterKey, query } from "@ai-comms-agent/db";
import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  ClaraAgentTurn,
  ClaraAgentTurnRequest,
  ClaraRuntimeContext,
  GroundedContext,
  ProviderConfig,
  ResolvedAIConfig,
} from "./types";

export type {
  ClaraRuntimeContext,
  ClaraAgentTurnRequest,
  ClaraAgentTurn,
} from "./types";

type StreamChunk = { choices?: Array<{ delta?: { content?: string | null } }> };

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function selectedProvider(): AIProvider {
  const value = (env("AI_PROVIDER") ?? "openai").toLowerCase();
  if (value === "gemini" || value === "sarvam") return value;
  return "openai";
}

function providerKey(provider: AIProvider): string | undefined {
  if (provider === "gemini") return env("GEMINI_API_KEY");
  if (provider === "sarvam") return env("SARVAM_API_KEY");
  return env("OPENAI_API_KEY");
}

function providerModel(provider: AIProvider): string {
  if (provider === "gemini") return env("GEMINI_CHAT_MODEL") ?? "gemini-2.0-flash";
  if (provider === "sarvam") return env("SARVAM_CHAT_MODEL") ?? "sarvam-105b-conversations";
  return env("OPENAI_CHAT_MODEL") ?? "gpt-4o-mini";
}

function providerBaseUrl(provider: AIProvider): string {
  if (provider === "gemini") return (env("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  if (provider === "sarvam") return (env("SARVAM_BASE_URL") ?? "https://api.sarvam.ai").replace(/\/$/, "");
  return (env("OPENAI_BASE_URL") ?? "https://api.openai.com").replace(/\/$/, "");
}

function providerConfig(provider: AIProvider): ProviderConfig {
  return {
    provider,
    apiKey: providerKey(provider),
    baseUrl: providerBaseUrl(provider),
    chatModel: providerModel(provider),
  };
}

function resolvedConfig(provider: AIProvider): ResolvedAIConfig {
  const maxTokens = Number(env("AI_MAX_CHAT_TOKENS") ?? 1500);
  const temperature = Number(env("AI_TEMPERATURE") ?? 0.8);
  return {
    provider,
    model: providerModel(provider),
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 1500,
    temperature: Number.isFinite(temperature) ? temperature : 0.8,
    assistantConfig: { systemPrompt: env("CLARA_SYSTEM_PROMPT") ?? "You are Clara, a helpful AI assistant for the user's communication workspace." },
  };
}

async function organizationAIConfig(orgId: string | null, agentId?: string | null): Promise<{ provider: AIProvider; providerConfig: ProviderConfig; resolved: ResolvedAIConfig; voice?: { provider: string; model: string; voiceId: string }; embedding?: { provider: string; model: string; dimension: number | null } } | null> {
  if (!orgId || !process.env.DATABASE_URL) return null;
  const settingsResult = await query<{
    default_provider: string; temperature: number | string; max_tokens: number | string;
    system_prompt: string; realtime_voice_provider: string; realtime_voice_model: string; voice_id: string;
    voice_chat_provider: string | null; voice_chat_tts_model: string | null; voice_chat_stt_model: string | null; voice_chat_voice_id: string | null;
    realtime_stt_model: string | null; realtime_tts_model: string | null;
    embedding_provider: string | null; embedding_model: string | null; embedding_dimension: number | null;
  }>("SELECT default_provider,temperature,max_tokens,system_prompt,realtime_voice_provider,realtime_voice_model,voice_id,voice_chat_provider,voice_chat_tts_model,voice_chat_stt_model,voice_chat_voice_id,realtime_stt_model,realtime_tts_model,embedding_provider,embedding_model,embedding_dimension FROM organization_ai_runtime_settings WHERE organization_id=$1", [orgId]);
  const settings = settingsResult.rows[0];
  if (!settings) return null;
  const provider = (["openai", "gemini", "sarvam"].includes(settings.default_provider) ? settings.default_provider : "openai") as AIProvider;
  const providerResult = await query<{ model: string | null; encrypted_api_key: Buffer | null; config: Record<string, unknown> | null; enabled: boolean }>(
    "SELECT model,encrypted_api_key,config,enabled FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose=$3 LIMIT 1",
    [orgId, provider, "chat"],
  );
  const saved = providerResult.rows[0];

  // Per-agent overrides — agentId is optional. NULL columns mean "inherit".
  let agentOverrides: {
    chatProvider: string | null; chatModel: string | null;
    realtimeVoiceProviderOverride: string | null; realtimeVoiceIdOverride: string | null;
    voiceChatProvider: string | null; voiceChatTtsModel: string | null;
    voiceChatSttModel: string | null; voiceChatVoiceId: string | null;
    embeddingProvider: string | null; embeddingModel: string | null; embeddingDimension: number | null;
    systemPromptOverride: string | null; temperatureOverride: number | null; maxTokensOverride: number | null;
  } | null = null;
  if (agentId) {
    const agentResult = await query<{
      chat_provider: string | null; chat_model: string | null;
      realtime_voice_provider_override: string | null; realtime_voice_id_override: string | null;
      voice_chat_provider: string | null; voice_chat_tts_model: string | null;
      voice_chat_stt_model: string | null; voice_chat_voice_id: string | null;
      embedding_provider: string | null; embedding_model: string | null; embedding_dimension: number | null;
      system_prompt_override: string | null; temperature_override: number | string | null; max_tokens_override: number | null;
    }>(
      "SELECT chat_provider, chat_model, realtime_voice_provider_override, realtime_voice_id_override, voice_chat_provider, voice_chat_tts_model, voice_chat_stt_model, voice_chat_voice_id, embedding_provider, embedding_model, embedding_dimension, system_prompt_override, temperature_override, max_tokens_override FROM agent_ai_settings WHERE organization_id=$1 AND agent_id=$2 LIMIT 1",
      [orgId, agentId],
    );
    if (agentResult.rows[0]) {
      const a = agentResult.rows[0];
      agentOverrides = {
        chatProvider: a.chat_provider, chatModel: a.chat_model,
        realtimeVoiceProviderOverride: a.realtime_voice_provider_override,
        realtimeVoiceIdOverride: a.realtime_voice_id_override,
        voiceChatProvider: a.voice_chat_provider, voiceChatTtsModel: a.voice_chat_tts_model,
        voiceChatSttModel: a.voice_chat_stt_model, voiceChatVoiceId: a.voice_chat_voice_id,
        embeddingProvider: a.embedding_provider, embeddingModel: a.embedding_model,
        embeddingDimension: a.embedding_dimension != null ? Number(a.embedding_dimension) : null,
        systemPromptOverride: a.system_prompt_override,
        temperatureOverride: a.temperature_override != null ? Number(a.temperature_override) : null,
        maxTokensOverride: a.max_tokens_override,
      };
    }
  }

  // Effective provider/model — agent override wins, then org settings, then env.
  const effectiveProvider = (agentOverrides?.chatProvider && ["openai", "gemini", "sarvam"].includes(agentOverrides.chatProvider)
    ? agentOverrides.chatProvider
    : provider) as AIProvider;
  const effectiveChatModel = (agentOverrides?.chatModel ?? saved?.model?.trim() ?? providerModel(effectiveProvider));

  // Re-fetch provider config if agent overrode the provider (different row in ai_provider_configs).
  let effectiveSaved = saved;
  if (agentOverrides?.chatProvider && agentOverrides.chatProvider !== provider) {
    const altResult = await query<{ model: string | null; encrypted_api_key: Buffer | null; config: Record<string, unknown> | null; enabled: boolean }>(
      "SELECT model,encrypted_api_key,config,enabled FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose=$3 LIMIT 1",
      [orgId, agentOverrides.chatProvider, "chat"],
    );
    if (altResult.rows[0]) effectiveSaved = altResult.rows[0];
  }

  if (effectiveSaved?.enabled && effectiveSaved.encrypted_api_key?.length) {
    const rawMasterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
    if (!rawMasterKey) throw new Error("AI provider credentials are saved, but CREDENTIALS_MASTER_KEY is not configured on the runtime.");
    const apiKey = decryptCredential(Buffer.from(effectiveSaved.encrypted_api_key), parseCredentialsMasterKey(rawMasterKey)).toString("utf8");
    const baseUrl = typeof effectiveSaved.config?.baseUrl === "string" && effectiveSaved.config.baseUrl ? effectiveSaved.config.baseUrl : providerBaseUrl(effectiveProvider);
    const model = effectiveChatModel || providerModel(effectiveProvider);
    return {
      provider: effectiveProvider,
      providerConfig: { provider: effectiveProvider, apiKey, baseUrl, chatModel: model },
      resolved: {
        provider: effectiveProvider, model,
        maxTokens: agentOverrides?.maxTokensOverride ?? (Number.isFinite(Number(settings.max_tokens)) ? Number(settings.max_tokens) : 1500),
        temperature: agentOverrides?.temperatureOverride ?? (Number.isFinite(Number(settings.temperature)) ? Number(settings.temperature) : 0.8),
        assistantConfig: { systemPrompt: agentOverrides?.systemPromptOverride ?? settings.system_prompt ?? "You are Clara, a helpful AI assistant for the user's communication workspace." },
      },
      voice: {
        provider: agentOverrides?.realtimeVoiceProviderOverride ?? settings.realtime_voice_provider,
        model: settings.realtime_voice_model,
        voiceId: agentOverrides?.realtimeVoiceIdOverride ?? settings.voice_id,
      },
      embedding: {
        provider: agentOverrides?.embeddingProvider ?? settings.embedding_provider ?? "openai",
        model: agentOverrides?.embeddingModel ?? settings.embedding_model ?? "text-embedding-3-small",
        dimension: agentOverrides?.embeddingDimension ?? (settings.embedding_dimension != null ? Number(settings.embedding_dimension) : 1536),
      },
    };
  }
  return {
    provider: effectiveProvider,
    providerConfig: providerConfig(effectiveProvider),
    resolved: {
      ...resolvedConfig(effectiveProvider),
      maxTokens: agentOverrides?.maxTokensOverride ?? (Number.isFinite(Number(settings.max_tokens)) ? Number(settings.max_tokens) : 1500),
      temperature: agentOverrides?.temperatureOverride ?? (Number.isFinite(Number(settings.temperature)) ? Number(settings.temperature) : 0.8),
      assistantConfig: { systemPrompt: agentOverrides?.systemPromptOverride ?? settings.system_prompt ?? "You are Clara, a helpful AI assistant for the user's communication workspace." },
    },
    voice: {
      provider: agentOverrides?.realtimeVoiceProviderOverride ?? settings.realtime_voice_provider,
      model: settings.realtime_voice_model,
      voiceId: agentOverrides?.realtimeVoiceIdOverride ?? settings.voice_id,
    },
    embedding: {
      provider: agentOverrides?.embeddingProvider ?? settings.embedding_provider ?? "openai",
      model: agentOverrides?.embeddingModel ?? settings.embedding_model ?? "text-embedding-3-small",
      dimension: agentOverrides?.embeddingDimension ?? (settings.embedding_dimension != null ? Number(settings.embedding_dimension) : 1536),
    },
  };
}

function assertApiKey(config: ProviderConfig): asserts config is ProviderConfig & { apiKey: string } {
  if (!config.apiKey) {
    throw new Error(`AI provider ${config.provider} is not configured. Set the corresponding server-side API key.`);
  }
}

async function readSseStream(response: Response): Promise<AsyncGenerator<string, void, unknown>> {
  if (!response.body) throw new Error("AI provider returned an empty streaming response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  async function* generator(): AsyncGenerator<string, void, unknown> {
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const payload = JSON.parse(data) as StreamChunk;
            const chunk = payload.choices?.[0]?.delta?.content;
            if (chunk) yield chunk;
          } catch {
            // Ignore provider keep-alives/non-JSON SSE lines.
          }
        }
      }
    }
  }

  return generator();
}

async function openAICompatibleStream(config: ProviderConfig, messages: ChatMessage[], options: ChatOptions): Promise<AsyncGenerator<string, void, unknown>> {
  assertApiKey(config);
  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.chatModel,
      messages,
      stream: true,
      temperature: options.temperature,
      // OpenAI deprecated max_tokens in favor of max_completion_tokens for
      // newer models (o1, o3, gpt-5, etc.). The old parameter causes a 400
      // error with those models. max_completion_tokens is accepted by both
      // old and new OpenAI models, and Sarvam's OpenAI-compatible API
      // silently ignores unknown parameters.
      max_completion_tokens: options.maxTokens,
      stop: options.stop,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI provider request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  return readSseStream(response);
}

async function geminiStream(config: ProviderConfig, messages: ChatMessage[], options: ChatOptions): Promise<AsyncGenerator<string, void, unknown>> {
  assertApiKey(config);
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `${config.baseUrl}/v1beta/models/${encodeURIComponent(config.chatModel ?? "gemini-2.0-flash")}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: { temperature: options.temperature, maxOutputTokens: options.maxTokens },
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  async function* generator(): AsyncGenerator<string, void, unknown> { if (text) yield text; }
  return generator();
}

async function chatStream(config: ProviderConfig, messages: ChatMessage[], options: ChatOptions): Promise<AsyncGenerator<string, void, unknown>> {
  if (config.provider === "gemini") return geminiStream(config, messages, options);
  return openAICompatibleStream(config, messages, options);
}

function tokenlessEmbeddingError(): Promise<number[]> {
  return Promise.reject(new Error("Embedding is not configured in the local Clara boundary. Configure a Clara/Qdrant indexing pipeline before requesting embeddings."));
}

/**
 * Generate an embedding vector for a single text input using the resolved
 * org/agent embedding provider. Supports OpenAI text-embedding-* models and
 * Gemini embedding-* models. TEI (local) is the operator's responsibility —
 * we surface the configured baseUrl if set, otherwise throw a clear error.
 */
async function embedTextOnce(
  config: { provider: string; model: string; apiKey: string; baseUrl: string },
  text: string,
): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Cannot embed empty text.");
  if (config.provider === "gemini") {
    const url = `${config.baseUrl}/v1beta/models/${encodeURIComponent(config.model)}:embedContent?key=${encodeURIComponent(config.apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text: trimmed }] } }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Gemini embedding failed (${response.status}): ${body.slice(0, 500)}`);
    }
    const payload = await response.json() as { embedding?: { values?: number[] } };
    if (!payload.embedding?.values?.length) throw new Error("Gemini returned no embedding values.");
    return payload.embedding.values;
  }
  // OpenAI-compatible (covers OpenAI + TEI proxies + vLLM embedding servers).
  const response = await fetch(`${config.baseUrl}/v1/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, input: trimmed }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI embedding failed (${response.status}): ${body.slice(0, 500)}`);
  }
  const payload = await response.json() as { data?: Array<{ embedding?: number[] }> };
  const vec = payload.data?.[0]?.embedding;
  if (!vec?.length) throw new Error("Provider returned no embedding values.");
  return vec;
}

async function embedBatchOnce(
  config: { provider: string; model: string; apiKey: string; baseUrl: string },
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (config.provider === "gemini") {
    // Gemini has no batch endpoint — embed each text in parallel.
    return Promise.all(texts.map((t) => embedTextOnce(config, t)));
  }
  // OpenAI-compatible — single batched request.
  const response = await fetch(`${config.baseUrl}/v1/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, input: texts.map((t) => t.trim()) }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI batch embedding failed (${response.status}): ${body.slice(0, 500)}`);
  }
  const payload = await response.json() as { data?: Array<{ embedding?: number[] }> };
  return (payload.data ?? []).map((item) => item.embedding ?? []);
}

async function groundContext(ctx: ClaraRuntimeContext, queryText: string, topK: number): Promise<GroundedContext> {
  if (!ctx.orgId || !process.env.DATABASE_URL) {
    return { ok: false, result: { sources: [] }, error: "PostgreSQL is not configured for local knowledge retrieval." };
  }
  const terms = [...new Set(queryText.toLowerCase().match(/[\\p{L}\\p{N}_]{2,}/gu) ?? [])].slice(0, 12);
  const textQuery = terms.join(" | ");
  if (!queryText.trim() || terms.length === 0) {
    return { ok: true, result: { sources: [] } };
  }
  try {
    const result = await query<{ id: string; content: string; metadata: Record<string, unknown> | null }>(
      `SELECT kc.id, kc.content, kc.metadata
       FROM knowledge_chunks kc
       WHERE kc.organization_id = $1
         AND EXISTS (
           SELECT 1 FROM knowledge_documents kd
           WHERE kd.id = kc.document_id
             AND kd.organization_id = kc.organization_id
             AND (
               ($2::text IS NULL AND kd.agent_id IS NULL)
               OR ($2::text IS NOT NULL AND (kd.agent_id IS NULL OR kd.agent_id::text = $2))
             )
         )
         AND (
           kc.content ILIKE '%' || $3 || '%'
           OR ($4::text <> '' AND to_tsvector('simple', kc.content) @@ to_tsquery('simple', $4))
         )
       ORDER BY
         CASE WHEN kc.content ILIKE '%' || $3 || '%' THEN 0 ELSE 1 END,
         CASE WHEN $4::text <> '' THEN ts_rank(to_tsvector('simple', kc.content), to_tsquery('simple', $4)) ELSE 0 END DESC,
         kc.created_at DESC
       LIMIT $5`,
      [ctx.orgId, ctx.agentId, queryText, textQuery, Math.max(1, Math.min(topK, 12))],
    );
    return {
      ok: true,
      result: {
        sources: result.rows.map((row) => ({
          id: row.id,
          snippet: row.content,
          metadata: row.metadata ?? {},
        })),
      },
    };
  } catch (error) {
    return { ok: false, result: { sources: [] }, error: error instanceof Error ? error.message : "Knowledge retrieval failed." };
  }
}

export const claraRuntime = {
  async resolveProvider(ctx: ClaraRuntimeContext, surface: "chat" | "realtime" | "embed" = "chat") {
    const organizationConfig = await organizationAIConfig(ctx.orgId, ctx.agentId);
    const provider = organizationConfig?.provider ?? selectedProvider();
    return { ...(organizationConfig?.resolved ?? resolvedConfig(provider)), surface, orgId: ctx.orgId, agentId: ctx.agentId };
  },

  async resolveVoice(ctx: ClaraRuntimeContext) {
    const organizationConfig = await organizationAIConfig(ctx.orgId, ctx.agentId);
    const provider = organizationConfig?.voice?.provider ?? env("REALTIME_VOICE_PROVIDER") ?? selectedProvider();
    return {
      realtimeProvider: provider,
      sessionEndpoint: "/api/voice/turn",
      voiceId: organizationConfig?.voice?.voiceId || env("OPENAI_DEFAULT_VOICE") || env("ELEVENLABS_VOICE_ID") || "alloy",
      model: organizationConfig?.voice?.model || env("OPENAI_REALTIME_MODEL") || "gpt-realtime-2.1-mini",
    };
  },

  async retrieve(ctx: ClaraRuntimeContext, queryText: string, options?: { topK?: number; ragMode?: "classic" | "hybrid" | "agentic"; channel?: "chat" | "voice" }) {
    return groundContext(ctx, queryText, options?.topK ?? 8);
  },

  /**
   * Embed a single text using the org/agent embedding provider.
   * Falls back to throwing the legacy "not configured" error when no org
   * embedding settings exist (preserves previous behavior for callers that
   * don't yet opt into embeddings).
   */
  async embedText(ctx: ClaraRuntimeContext, text: string): Promise<number[]> {
    const organizationConfig = await organizationAIConfig(ctx.orgId, ctx.agentId);
    const embedding = organizationConfig?.embedding;
    if (!embedding?.provider || !embedding?.model) {
      // Fall back to env-provided OPENAI_API_KEY / GEMINI_API_KEY + a default model.
      const provider = (env("EMBEDDING_PROVIDER") ?? "openai") as string;
      const model = env("EMBEDDING_MODEL") ?? "text-embedding-3-small";
      const apiKey = provider === "gemini" ? env("GEMINI_API_KEY") : env("OPENAI_API_KEY");
      const baseUrl = provider === "gemini" ? "https://generativelanguage.googleapis.com" : "https://api.openai.com";
      if (!apiKey) return tokenlessEmbeddingError();
      return embedTextOnce({ provider, model, apiKey, baseUrl }, text);
    }
    // Resolve the embedding provider's API key from ai_provider_configs(purpose='embedding').
    const embeddingConfigResult = await query<{ encrypted_api_key: Buffer | null; config: Record<string, unknown> | null; enabled: boolean }>(
      "SELECT encrypted_api_key,config,enabled FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose=$3 LIMIT 1",
      [ctx.orgId, embedding.provider, "embedding"],
    );
    const saved = embeddingConfigResult.rows[0];
    let apiKey: string | undefined;
    if (saved?.enabled && saved.encrypted_api_key?.length) {
      const rawMasterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
      if (!rawMasterKey) throw new Error("CREDENTIALS_MASTER_KEY is not configured.");
      apiKey = decryptCredential(Buffer.from(saved.encrypted_api_key), parseCredentialsMasterKey(rawMasterKey)).toString("utf8");
    } else {
      apiKey = embedding.provider === "gemini" ? env("GEMINI_API_KEY") : env("OPENAI_API_KEY");
    }
    if (!apiKey) return tokenlessEmbeddingError();
    const baseUrl = (typeof saved?.config?.baseUrl === "string" && saved.config.baseUrl)
      ? saved.config.baseUrl
      : embedding.provider === "gemini" ? "https://generativelanguage.googleapis.com" : "https://api.openai.com";
    return embedTextOnce({ provider: embedding.provider, model: embedding.model, apiKey, baseUrl }, text);
  },

  async embedBatch(ctx: ClaraRuntimeContext, texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const organizationConfig = await organizationAIConfig(ctx.orgId, ctx.agentId);
    const embedding = organizationConfig?.embedding;
    if (!embedding?.provider || !embedding?.model) {
      const provider = (env("EMBEDDING_PROVIDER") ?? "openai") as string;
      const model = env("EMBEDDING_MODEL") ?? "text-embedding-3-small";
      const apiKey = provider === "gemini" ? env("GEMINI_API_KEY") : env("OPENAI_API_KEY");
      const baseUrl = provider === "gemini" ? "https://generativelanguage.googleapis.com" : "https://api.openai.com";
      if (!apiKey) return Promise.all(texts.map(() => tokenlessEmbeddingError())) as unknown as Promise<number[][]>;
      return embedBatchOnce({ provider, model, apiKey, baseUrl }, texts);
    }
    const embeddingConfigResult = await query<{ encrypted_api_key: Buffer | null; config: Record<string, unknown> | null; enabled: boolean }>(
      "SELECT encrypted_api_key,config,enabled FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose=$3 LIMIT 1",
      [ctx.orgId, embedding.provider, "embedding"],
    );
    const saved = embeddingConfigResult.rows[0];
    let apiKey: string | undefined;
    if (saved?.enabled && saved.encrypted_api_key?.length) {
      const rawMasterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
      if (!rawMasterKey) throw new Error("CREDENTIALS_MASTER_KEY is not configured.");
      apiKey = decryptCredential(Buffer.from(saved.encrypted_api_key), parseCredentialsMasterKey(rawMasterKey)).toString("utf8");
    } else {
      apiKey = embedding.provider === "gemini" ? env("GEMINI_API_KEY") : env("OPENAI_API_KEY");
    }
    if (!apiKey) return Promise.all(texts.map(() => tokenlessEmbeddingError())) as unknown as Promise<number[][]>;
    const baseUrl = (typeof saved?.config?.baseUrl === "string" && saved.config.baseUrl)
      ? saved.config.baseUrl
      : embedding.provider === "gemini" ? "https://generativelanguage.googleapis.com" : "https://api.openai.com";
    return embedBatchOnce({ provider: embedding.provider, model: embedding.model, apiKey, baseUrl }, texts);
  },

  async createChatTurn(request: ClaraAgentTurnRequest): Promise<ClaraAgentTurn> {
    const messages = request.messages.filter((message) => message.content.trim());
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) throw new Error("A user message is required.");

    const organizationConfig = await organizationAIConfig(request.orgId, request.agentId);
    const provider = organizationConfig?.provider ?? selectedProvider();
    const config = organizationConfig?.resolved ?? resolvedConfig(provider);
    const providerSettings = organizationConfig?.providerConfig ?? providerConfig(provider);
    const grounding = await groundContext(request, lastUserMessage.content, request.surface === "realtime" ? 4 : 8);
    const evidence = grounding.ok
      ? grounding.result.sources.map((source, index) => `[S${index + 1}] ${source.snippet}`).join("\n\n")
      : "";
    const system = [
      config.assistantConfig.systemPrompt,
      evidence ? `Knowledge base context:\n${evidence}` : "",
    ].filter(Boolean).join("\n\n");

    const stream = await chatStream(providerSettings, [
      { role: "system", content: system },
      ...messages,
    ], {
      maxTokens: config.maxTokens ?? undefined,
      temperature: config.temperature ?? undefined,
    });

    return { config, providerName: provider, model: config.model, stream, grounding };
  },

  async startRealtimeSession(ctx: ClaraRuntimeContext) {
    return this.resolveVoice(ctx);
  },

  tools: {
    list() {
      return [{ name: "rag_search", description: "Retrieve tenant-bound evidence from the local knowledge index." }];
    },

    async invoke(ctx: ClaraRuntimeContext, name: string, input: unknown) {
      if (name !== "rag_search") throw new Error("Unsupported Clara tool: " + name);
      const payload = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const queryText = typeof payload.query === "string" ? payload.query.trim() : "";
      if (!queryText) throw new Error("rag_search requires a query.");
      return claraRuntime.retrieve(ctx, queryText, {
        ragMode: payload.ragMode === "classic" || payload.ragMode === "agentic" ? payload.ragMode : "hybrid",
        channel: "voice",
      });
    },
  },
} as const;

export function createProvider(config: ProviderConfig) {
  return {
    chatStream: (messages: ChatMessage[], options: ChatOptions = {}) => chatStream(config, messages, options),
    embedText: (text: string) => embedTextOnce(
      {
        provider: config.provider,
        model: config.embeddingModel ?? "text-embedding-3-small",
        apiKey: config.apiKey ?? "",
        baseUrl: config.baseUrl ?? providerBaseUrl(config.provider as AIProvider),
      },
      text,
    ),
    embedBatch: (texts: string[]) => embedBatchOnce(
      {
        provider: config.provider,
        model: config.embeddingModel ?? "text-embedding-3-small",
        apiKey: config.apiKey ?? "",
        baseUrl: config.baseUrl ?? providerBaseUrl(config.provider as AIProvider),
      },
      texts,
    ),
    getProviderName: () => config.provider,
    getModelName: (type: "chat" | "embedding") => type === "chat" ? (config.chatModel ?? "unknown") : (config.embeddingModel ?? "unknown"),
    getEmbeddingDimension: () => Number(config.embeddingDimension ?? 0),
  };
}
