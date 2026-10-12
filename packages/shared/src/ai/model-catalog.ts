/**
 * packages/shared/src/ai/model-catalog.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Canonical AI model catalog for the ai-comms-agent platform —
 * ports the relevant subset of vendor/clara/clara-core/.../{ai-core,voice-core,
 * assistant/api}/model-catalog.ts so the running app has a single source of
 * truth for:
 *
 *   • Chat models     (OpenAI / Gemini / Sarvam)
 *   • TTS models      (ElevenLabs / Sarvam Bulbul)
 *   • STT models      (ElevenLabs Scribe / Sarvam Saaras)
 *   • Realtime models (OpenAI Realtime / Gemini Live / Sarvam realtime)
 *   • Embedding models(OpenAI text-embedding-3-* / Gemini embedding-001 etc.)
 *
 * The catalog is consumed by:
 *   • the settings UI dropdowns  — only catalogued models are offered
 *   • the settings API validation — writes rejected when an unknown model id
 *     lands in a category field (e.g. a chat model id in an embedding field)
 *   • the local claraRuntime     — provider selection + model defaults
 *
 * SERVER-ONLY. Must never be imported by client code (the catalog ships
 * pricing data which we do not want in client bundles).
 */

export type ChatProvider = "openai" | "gemini" | "sarvam";
export type VoiceChatProvider = "openai" | "gemini" | "sarvam" | "elevenlabs";
export type RealtimeProvider = "openai" | "gemini" | "sarvam" | "elevenlabs";
export type EmbeddingProvider = "openai" | "gemini" | "tei";

export type AiPurpose =
  | "chat"
  | "tts"
  | "stt"
  | "realtime"
  | "embedding"
  | "general";

export interface ChatModelEntry {
  id: string;
  provider: ChatProvider;
  label?: string;
  contextTokens?: number;
  inputUsdPerMTokens?: number;
  outputUsdPerMTokens?: number;
  beta?: boolean;
}

export interface TtsModelEntry {
  id: string;
  provider: VoiceChatProvider;
  name: string;
  latencyClass: "low" | "medium" | "high";
  maxCharactersPerRequest: number;
  usdPer1kChars: number;
  multilingual: boolean;
}

export interface SttModelEntry {
  id: string;
  provider: VoiceChatProvider;
  name: string;
  maxAudioSecondsPerRequest: number;
  usdPerMinute: number;
  autoDetectLanguage: boolean;
}

export interface RealtimeModelEntry {
  id: string;
  provider: RealtimeProvider;
  name: string;
  contextTokens?: number;
  supportsVoice?: boolean;
}

export interface EmbeddingModelEntry {
  id: string;
  provider: EmbeddingProvider;
  dimension: number;
  inputUsdPerMTokens?: number;
  matryoshkaMaxDimension?: number;
}

// ─── OpenAI Chat ───────────────────────────────────────────────────────────

export const OPENAI_CHAT_MODELS: ChatModelEntry[] = [
  { id: "gpt-4o",               provider: "openai", contextTokens: 128_000, inputUsdPerMTokens: 2.5,  outputUsdPerMTokens: 10 },
  { id: "gpt-4o-mini",          provider: "openai", contextTokens: 128_000, inputUsdPerMTokens: 0.15, outputUsdPerMTokens: 0.6 },
  { id: "gpt-4o-2024-08-06",    provider: "openai", contextTokens: 128_000, inputUsdPerMTokens: 2.5,  outputUsdPerMTokens: 10 },
  { id: "gpt-4-turbo",          provider: "openai", contextTokens: 128_000, inputUsdPerMTokens: 10,  outputUsdPerMTokens: 30 },
  { id: "gpt-4",                provider: "openai", contextTokens: 8_192,   inputUsdPerMTokens: 30,  outputUsdPerMTokens: 60 },
  { id: "gpt-3.5-turbo",        provider: "openai", contextTokens: 16_385,  inputUsdPerMTokens: 0.5, outputUsdPerMTokens: 1.5 },
  { id: "o1-preview",           provider: "openai", contextTokens: 128_000, inputUsdPerMTokens: 15,  outputUsdPerMTokens: 60, beta: true },
  { id: "o1-mini",              provider: "openai", contextTokens: 128_000, inputUsdPerMTokens: 3,   outputUsdPerMTokens: 12, beta: true },
];

// ─── Gemini Chat ────────────────────────────────────────────────────────────

export const GEMINI_CHAT_MODELS: ChatModelEntry[] = [
  { id: "gemini-2.5-flash",      provider: "gemini", contextTokens: 1_048_576, inputUsdPerMTokens: 0.3,   outputUsdPerMTokens: 2.5 },
  { id: "gemini-2.5-pro",        provider: "gemini", contextTokens: 1_048_576, inputUsdPerMTokens: 1.25,  outputUsdPerMTokens: 10 },
  { id: "gemini-2.0-flash",      provider: "gemini", contextTokens: 1_048_576, inputUsdPerMTokens: 0.1,   outputUsdPerMTokens: 0.4 },
  { id: "gemini-2.0-pro",        provider: "gemini", contextTokens: 2_097_152, inputUsdPerMTokens: 3.5,   outputUsdPerMTokens: 10.5 },
  { id: "gemini-1.5-flash",      provider: "gemini", contextTokens: 1_048_576, inputUsdPerMTokens: 0.075, outputUsdPerMTokens: 0.3 },
  { id: "gemini-1.5-pro",        provider: "gemini", contextTokens: 2_097_152, inputUsdPerMTokens: 1.25,  outputUsdPerMTokens: 5 },
  { id: "gemini-1.5-flash-8b",   provider: "gemini", contextTokens: 1_048_576, inputUsdPerMTokens: 0.0375, outputUsdPerMTokens: 0.15 },
];

// ─── Sarvam Chat ───────────────────────────────────────────────────────────
// Sarvam publishes NO embeddings API; chat only.

export const SARVAM_CHAT_MODELS: ChatModelEntry[] = [
  { id: "sarvam-105b",              provider: "sarvam", label: "Sarvam 105B (128K)",              contextTokens: 128_000, inputUsdPerMTokens: 0.35, outputUsdPerMTokens: 0.88 },
  { id: "sarvam-105b-conversations", provider: "sarvam", label: "Sarvam 105B Conversations (32K)", contextTokens: 32_000,  inputUsdPerMTokens: 0.35, outputUsdPerMTokens: 0.88 },
  { id: "sarvam-8b-conversations",   provider: "sarvam", label: "Sarvam 8B Conversations",        contextTokens: 8_000,   inputUsdPerMTokens: 0.10, outputUsdPerMTokens: 0.20 },
];

export const ALL_CHAT_MODELS: ChatModelEntry[] = [
  ...OPENAI_CHAT_MODELS,
  ...GEMINI_CHAT_MODELS,
  ...SARVAM_CHAT_MODELS,
];

// ─── ElevenLabs TTS ───────────────────────────────────────────────────────

export const ELEVENLABS_TTS_MODELS: TtsModelEntry[] = [
  { id: "eleven_flash_v2_5",      provider: "elevenlabs", name: "Eleven Flash v2.5",       latencyClass: "low",    maxCharactersPerRequest: 40_000, usdPer1kChars: 0.06, multilingual: true },
  { id: "eleven_turbo_v2_5",      provider: "elevenlabs", name: "Eleven Turbo v2.5",       latencyClass: "low",    maxCharactersPerRequest: 40_000, usdPer1kChars: 0.08, multilingual: true },
  { id: "eleven_multilingual_v2", provider: "elevenlabs", name: "Eleven Multilingual v2",  latencyClass: "medium", maxCharactersPerRequest: 10_000, usdPer1kChars: 0.15, multilingual: true },
  { id: "eleven_v3",              provider: "elevenlabs", name: "Eleven v3 (alpha)",        latencyClass: "medium", maxCharactersPerRequest: 10_000, usdPer1kChars: 0.15, multilingual: true },
];

// ─── Sarvam TTS (Bulbul) ──────────────────────────────────────────────────

export const SARVAM_TTS_MODELS: TtsModelEntry[] = [
  { id: "bulbul:v3", provider: "sarvam", name: "Bulbul v3",          latencyClass: "medium", maxCharactersPerRequest: 2_500, usdPer1kChars: 0.036, multilingual: true },
  { id: "bulbul:v2", provider: "sarvam", name: "Bulbul v2 (legacy)", latencyClass: "medium", maxCharactersPerRequest: 2_500, usdPer1kChars: 0.036, multilingual: true },
];

export const ALL_TTS_MODELS: TtsModelEntry[] = [
  ...ELEVENLABS_TTS_MODELS,
  ...SARVAM_TTS_MODELS,
];

// ─── ElevenLabs STT (Scribe) ───────────────────────────────────────────────

export const ELEVENLABS_STT_MODELS: SttModelEntry[] = [
  { id: "scribe_v2",            provider: "elevenlabs", name: "Scribe v2 (batch)",          maxAudioSecondsPerRequest: 300, usdPerMinute: 0.012, autoDetectLanguage: true },
  { id: "scribe_v2_realtime",   provider: "elevenlabs", name: "Scribe v2 Realtime (WS)",   maxAudioSecondsPerRequest: 120, usdPerMinute: 0.018, autoDetectLanguage: true },
];

// ─── Sarvam STT (Saaras) ───────────────────────────────────────────────────

export const SARVAM_STT_MODELS: SttModelEntry[] = [
  { id: "saaras:v3", provider: "sarvam", name: "Saaras v3 (default)",            maxAudioSecondsPerRequest: 30, usdPerMinute: 0.006, autoDetectLanguage: true },
  { id: "saaras:v4", provider: "sarvam", name: "Saaras v4 (Global English)",     maxAudioSecondsPerRequest: 30, usdPerMinute: 0.006, autoDetectLanguage: true },
];

export const ALL_STT_MODELS: SttModelEntry[] = [
  ...ELEVENLABS_STT_MODELS,
  ...SARVAM_STT_MODELS,
];

// ─── Realtime voice AI agents ──────────────────────────────────────────────
// These are the "Mode B" / "realtime voice AI" providers — actual realtime
// conversations, not TTS+STT pipeline. OpenAI Realtime and Gemini Live are
// fully realized; Sarvam has a realtime WebSocket STT (saaras:v3-realtime).

export const REALTIME_MODELS: RealtimeModelEntry[] = [
  { id: "gpt-realtime-2.1-mini",     provider: "openai",     name: "OpenAI Realtime 2.1 Mini",   contextTokens: 32_000, supportsVoice: true },
  { id: "gpt-realtime-2.1",          provider: "openai",     name: "OpenAI Realtime 2.1",        contextTokens: 32_000, supportsVoice: true },
  { id: "gpt-4o-realtime",           provider: "openai",     name: "GPT-4o Realtime",            contextTokens: 128_000, supportsVoice: true },
  { id: "gemini-2.5-flash-live",     provider: "gemini",    name: "Gemini 2.5 Flash Live",      contextTokens: 1_048_576, supportsVoice: true },
  { id: "gemini-2.0-flash-live",     provider: "gemini",    name: "Gemini 2.0 Flash Live",      contextTokens: 1_048_576, supportsVoice: true },
  { id: "saaras:v3-realtime",        provider: "sarvam",    name: "Sarvam Saaras v3 Realtime",  supportsVoice: true },
  { id: "elevenlabs-conversational", provider: "elevenlabs", name: "ElevenLabs Conversational AI", supportsVoice: true },
];

export const OPENAI_REALTIME_VOICES: string[] = [
  "alloy", "ash", "ballad", "cedar", "coral",
  "echo", "marin", "sage", "shimmer", "verse",
];

// ─── Embedding models ──────────────────────────────────────────────────────

export const OPENAI_EMBEDDING_MODELS: EmbeddingModelEntry[] = [
  { id: "text-embedding-3-small",  provider: "openai", dimension: 1536, inputUsdPerMTokens: 0.02 },
  { id: "text-embedding-3-large",  provider: "openai", dimension: 3072, inputUsdPerMTokens: 0.13 },
  { id: "text-embedding-ada-002",  provider: "openai", dimension: 1536, inputUsdPerMTokens: 0.1 },
];

export const GEMINI_EMBEDDING_MODELS: EmbeddingModelEntry[] = [
  { id: "gemini-embedding-001", provider: "gemini", dimension: 3072, inputUsdPerMTokens: 0.075, matryoshkaMaxDimension: 3072 },
  { id: "text-embedding-004",    provider: "gemini", dimension: 768,  inputUsdPerMTokens: 0.075 },
  { id: "embedding-001",        provider: "gemini", dimension: 768,  inputUsdPerMTokens: 0.075 },
];

export const ALL_EMBEDDING_MODELS: EmbeddingModelEntry[] = [
  ...OPENAI_EMBEDDING_MODELS,
  ...GEMINI_EMBEDDING_MODELS,
];

// ─── Provider labels for UI ────────────────────────────────────────────────

export const CHAT_PROVIDER_LABELS: Record<ChatProvider, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  sarvam: "Sarvam AI",
};

export const VOICE_CHAT_PROVIDER_LABELS: Record<VoiceChatProvider, string> = {
  openai:     "OpenAI (TTS)",
  gemini:     "Google (TTS)",
  sarvam:     "Sarvam AI (Bulbul / Saaras)",
  elevenlabs: "ElevenLabs",
};

export const REALTIME_PROVIDER_LABELS: Record<RealtimeProvider, string> = {
  openai:     "OpenAI Realtime",
  gemini:     "Gemini Live",
  sarvam:     "Sarvam AI (realtime WebSocket)",
  elevenlabs: "ElevenLabs Conversational AI",
};

export const EMBEDDING_PROVIDER_LABELS: Record<EmbeddingProvider, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  tei:    "HuggingFace TEI (local)",
};

// ─── Validation helpers ────────────────────────────────────────────────────

export function findChatModel(id: string): ChatModelEntry | undefined {
  return ALL_CHAT_MODELS.find((m) => m.id === id?.trim());
}
export function findTtsModel(id: string): TtsModelEntry | undefined {
  return ALL_TTS_MODELS.find((m) => m.id === id?.trim());
}
export function findSttModel(id: string): SttModelEntry | undefined {
  return ALL_STT_MODELS.find((m) => m.id === id?.trim());
}
export function findRealtimeModel(id: string): RealtimeModelEntry | undefined {
  return REALTIME_MODELS.find((m) => m.id === id?.trim());
}
export function findEmbeddingModel(id: string): EmbeddingModelEntry | undefined {
  return ALL_EMBEDDING_MODELS.find((m) => m.id === id?.trim());
}

export function isKnownChatModel(id: string): boolean {
  return findChatModel(id) != null;
}
export function isKnownTtsModel(id: string): boolean {
  return findTtsModel(id) != null;
}
export function isKnownSttModel(id: string): boolean {
  return findSttModel(id) != null;
}
export function isKnownRealtimeModel(id: string): boolean {
  return findRealtimeModel(id) != null;
}
export function isKnownEmbeddingModel(id: string): boolean {
  return findEmbeddingModel(id) != null;
}

/** Returns the default chat model for a given provider (first entry). */
export function defaultChatModelFor(provider: ChatProvider): string {
  const first = ALL_CHAT_MODELS.find((m) => m.provider === provider);
  return first?.id ?? "gpt-4o-mini";
}

/** Returns the default embedding model for a given provider. */
export function defaultEmbeddingModelFor(provider: EmbeddingProvider): string {
  if (provider === "openai") return "text-embedding-3-small";
  if (provider === "gemini") return "text-embedding-004";
  return "bge-base-en"; // TEI default
}

/** Returns the embedding dimension for a given model id (null if unknown). */
export function embeddingDimensionFor(modelId: string): number | null {
  return findEmbeddingModel(modelId)?.dimension ?? null;
}
