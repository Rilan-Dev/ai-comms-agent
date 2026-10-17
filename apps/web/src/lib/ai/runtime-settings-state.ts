/**
 * Translate API/database camelCase settings to the snake_case names used by
 * the editing form and its PUT endpoint. Never merge raw API data over
 * snake_case defaults: that silently submits defaults instead of saved values.
 */
export type RuntimeSettings = {
  default_provider: string;
  knowledge_base_id: string;
  realtime_voice_provider: string;
  realtime_voice_model: string;
  voice_id: string;
  temperature: number | string;
  max_tokens: number | string;
  system_prompt: string;
};

export const initialRuntimeSettings: RuntimeSettings = {
  default_provider: "openai",
  knowledge_base_id: "",
  realtime_voice_provider: "openai",
  realtime_voice_model: "",
  voice_id: "alloy",
  temperature: 0.8,
  max_tokens: 1500,
  system_prompt: "You are Clara, a helpful AI assistant for the user's communication workspace.",
};

export function normalizeRuntimeSettings(payload: unknown): RuntimeSettings {
  const data: Record<string, unknown> = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown> : {};
  const field = (snake: string, camel: string): unknown => data[snake] ?? data[camel];
  const stringField = (snake: string, camel: string, fallback: string): string => {
    const value = field(snake, camel);
    return typeof value === "string" ? value : fallback;
  };
  const numericField = (snake: string, camel: string, fallback: number): number | string => {
    const value = field(snake, camel);
    return (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
      ? value : fallback;
  };

  return {
    default_provider: stringField("default_provider", "defaultProvider", initialRuntimeSettings.default_provider),
    knowledge_base_id: stringField("knowledge_base_id", "knowledgeBaseId", initialRuntimeSettings.knowledge_base_id),
    realtime_voice_provider: stringField("realtime_voice_provider", "realtimeVoiceProvider", initialRuntimeSettings.realtime_voice_provider),
    realtime_voice_model: stringField("realtime_voice_model", "realtimeVoiceModel", initialRuntimeSettings.realtime_voice_model),
    voice_id: stringField("voice_id", "voiceId", initialRuntimeSettings.voice_id),
    temperature: numericField("temperature", "temperature", 0.8),
    max_tokens: numericField("max_tokens", "maxTokens", 1500),
    system_prompt: stringField("system_prompt", "systemPrompt", initialRuntimeSettings.system_prompt),
  };
}
