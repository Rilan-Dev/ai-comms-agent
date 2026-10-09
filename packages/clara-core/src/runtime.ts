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

async function organizationAIConfig(orgId: string | null): Promise<{ provider: AIProvider; providerConfig: ProviderConfig; resolved: ResolvedAIConfig; voice?: { provider: string; model: string; voiceId: string } } | null> {
  if (!orgId || !process.env.DATABASE_URL) return null;
  const settingsResult = await query<{
    default_provider: string; temperature: number | string; max_tokens: number | string;
    system_prompt: string; realtime_voice_provider: string; realtime_voice_model: string; voice_id: string;
  }>("SELECT default_provider,temperature,max_tokens,system_prompt,realtime_voice_provider,realtime_voice_model,voice_id FROM organization_ai_runtime_settings WHERE organization_id=$1", [orgId]);
  const settings = settingsResult.rows[0];
  if (!settings) return null;
  const provider = (["openai", "gemini", "sarvam"].includes(settings.default_provider) ? settings.default_provider : "openai") as AIProvider;
  const providerResult = await query<{ model: string | null; encrypted_api_key: Buffer | null; config: Record<string, unknown> | null; enabled: boolean }>(
    "SELECT model,encrypted_api_key,config,enabled FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose=$3 LIMIT 1",
    [orgId, provider, "chat"],
  );
  const saved = providerResult.rows[0];
  if (saved?.enabled && saved.encrypted_api_key?.length) {
    const rawMasterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
    if (!rawMasterKey) throw new Error("AI provider credentials are saved, but CREDENTIALS_MASTER_KEY is not configured on the runtime.");
    const apiKey = decryptCredential(Buffer.from(saved.encrypted_api_key), parseCredentialsMasterKey(rawMasterKey)).toString("utf8");
    const baseUrl = typeof saved.config?.baseUrl === "string" && saved.config.baseUrl ? saved.config.baseUrl : providerBaseUrl(provider);
    const model = saved.model?.trim() || providerModel(provider);
    return {
      provider,
      providerConfig: { provider, apiKey, baseUrl, chatModel: model },
      resolved: {
        provider, model,
        maxTokens: Number.isFinite(Number(settings.max_tokens)) ? Number(settings.max_tokens) : 1500,
        temperature: Number.isFinite(Number(settings.temperature)) ? Number(settings.temperature) : 0.8,
        assistantConfig: { systemPrompt: settings.system_prompt || "You are Clara, a helpful AI assistant for the user's communication workspace." },
      },
      voice: { provider: settings.realtime_voice_provider, model: settings.realtime_voice_model, voiceId: settings.voice_id },
    };
  }
  return {
    provider,
    providerConfig: providerConfig(provider),
    resolved: {
      ...resolvedConfig(provider),
      maxTokens: Number.isFinite(Number(settings.max_tokens)) ? Number(settings.max_tokens) : 1500,
      temperature: Number.isFinite(Number(settings.temperature)) ? Number(settings.temperature) : 0.8,
      assistantConfig: { systemPrompt: settings.system_prompt || "You are Clara, a helpful AI assistant for the user's communication workspace." },
    },
    voice: { provider: settings.realtime_voice_provider, model: settings.realtime_voice_model, voiceId: settings.voice_id },
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
      max_tokens: options.maxTokens,
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

async function groundContext(ctx: ClaraRuntimeContext, queryText: string, topK: number): Promise<GroundedContext> {
  if (!ctx.orgId || !process.env.DATABASE_URL) {
    return { ok: false, result: { sources: [] }, error: "PostgreSQL is not configured for local knowledge retrieval." };
  }
  try {
    const result = await query<{ id: string; content: string; metadata: Record<string, unknown> | null }>(
      `SELECT kc.id, kc.content, kc.metadata
       FROM knowledge_chunks kc
       WHERE kc.organization_id = $1
         AND ($2::text IS NULL OR EXISTS (
           SELECT 1 FROM knowledge_documents kd
           WHERE kd.id = kc.document_id
             AND ($2::text = '' OR kd.agent_id::text = $2)
         ))
         AND kc.content ILIKE '%' || $3 || '%'
       ORDER BY kc.created_at DESC
       LIMIT $4`,
      [ctx.orgId, ctx.agentId ?? "", queryText, Math.max(1, Math.min(topK, 12))],
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
    const organizationConfig = await organizationAIConfig(ctx.orgId);
    const provider = organizationConfig?.provider ?? selectedProvider();
    return { ...(organizationConfig?.resolved ?? resolvedConfig(provider)), surface, orgId: ctx.orgId, agentId: ctx.agentId };
  },

  async resolveVoice(ctx: ClaraRuntimeContext) {
    const organizationConfig = await organizationAIConfig(ctx.orgId);
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

  async createChatTurn(request: ClaraAgentTurnRequest): Promise<ClaraAgentTurn> {
    const messages = request.messages.filter((message) => message.content.trim());
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) throw new Error("A user message is required.");

    const organizationConfig = await organizationAIConfig(request.orgId);
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
    embedText: () => tokenlessEmbeddingError(),
    embedBatch: () => tokenlessEmbeddingError(),
    getProviderName: () => config.provider,
    getModelName: (type: "chat" | "embedding") => type === "chat" ? (config.chatModel ?? "unknown") : (config.embeddingModel ?? "unknown"),
    getEmbeddingDimension: () => Number(config.embeddingDimension ?? 0),
  };
}
