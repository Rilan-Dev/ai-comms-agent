/**
 * Local runtime contracts.
 *
 * These contracts are intentionally self-contained and carry no reference-repository
 * dependency: the runtime boundary is fully owned by this application.
 */

export type AIProvider = "openai" | "gemini" | "sarvam";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  reasoningEffort?: "low" | "medium" | "high" | null;
  onUsage?: (usage: TokenUsage) => void;
}

export interface EmbedOptions {
  onUsage?: (usage: TokenUsage) => void;
}

export interface LLMProvider {
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string, void, unknown>;
  /** Optional for compatibility; unsupported providers must fail explicitly, never silently ignore tools. */
  chatWithTools?(messages: ToolChatMessage[], tools: ChatToolDefinition[], options?: ChatOptions): Promise<ChatToolCompletion>;
  embedText(text: string, options?: EmbedOptions): Promise<number[]>;
  embedBatch(texts: string[], options?: EmbedOptions): Promise<number[][]>;
  getProviderName(): string;
  getModelName(type: "chat" | "embedding"): string;
  getEmbeddingDimension(): number;
}

export type EmbeddingProviderId = AIProvider | "tei";

export interface ProviderConfig {
  provider: EmbeddingProviderId;
  apiKey?: string;
  baseUrl?: string;
  chatModel?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
}

export type VoiceProvider = "openai" | "gemini" | "sarvam" | "elevenlabs";
export interface VoiceProviderService { readonly provider: VoiceProvider; }
export interface ConversationalVoiceService extends VoiceProviderService {}

export type GroundingRagMode = "classic" | "hybrid" | "agentic";
export interface GroundingRequest {
  kbId: string;
  query: string;
  searchQuery?: string;
  topK?: number;
  ragMode?: GroundingRagMode;
  surface?: "search" | "workspace" | "voice" | "embed";
  sessionId?: string | null;
  userId?: string | null;
  admission?: "external";
  channel?: "chat" | "voice";
}
export interface GroundedSource {
  id: string;
  snippet: string;
  metadata?: Record<string, unknown>;
}
export interface GroundedContext {
  ok: boolean;
  result: { sources: GroundedSource[] };
  error?: string;
}

export interface AgentRuntimeContext {
  /** Restrictive host scope for turns that do not request ambient retrieval. */
  skipGrounding?:boolean;
  orgId: string | null;
  agentId: string | null;
  kbId: string;
  userId?: string | null;
  sessionId?: string | null;
  /** Optional host-resolved agent/org voice settings; provider credentials remain server-side. */
  voiceOverride?: { provider?: string | null; model?: string | null; voiceId?: string | null };
}

/** Optional host-resolved settings for a single turn. Null retains current
 * organization inheritance; this carries no policy or permission grants. */
export type AgentAiOverrides={
 chatProvider?:string|null;chatModel?:string|null;
 voiceChatProvider?:string|null;voiceChatTtsModel?:string|null;voiceChatSttModel?:string|null;voiceChatVoiceId?:string|null;
 realtimeVoiceProviderOverride?:string|null;realtimeSttModel?:string|null;realtimeTtsModel?:string|null;realtimeVoiceIdOverride?:string|null;
 embeddingProvider?:string|null;embeddingModel?:string|null;embeddingDimension?:number|null;
 systemPromptOverride?:string|null;temperatureOverride?:number|null;maxTokensOverride?:number|null;
};

export interface AgentTurnRequest extends AgentRuntimeContext {
  messages: ChatMessage[];
  surface?: "chat" | "realtime" | "embed";
  ragMode?: GroundingRagMode;
}

export interface ResolvedAIConfig {
  provider: AIProvider;
  model: string;
  maxTokens: number | null;
  temperature: number | null;
  assistantConfig: { systemPrompt?: string | null };
}

export interface AgentTurn {
  config: ResolvedAIConfig;
  providerName: string;
  model: string;
  stream: AsyncGenerator<string, void, unknown>;
  grounding: GroundedContext;
}


/** Provider-neutral tool calling contracts. Tool results are data, never trusted instructions. */
export interface ChatToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface ChatToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Opaque Gemini provider token. Preserve verbatim between tool rounds; never generate or log it. */
  thoughtSignature?: string;
}
export interface GeminiModelPart {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args: Record<string, unknown> };
  thoughtSignature?: string;
}
export type ToolChatMessage =
  | ChatMessage
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[]; geminiParts?: GeminiModelPart[] }
  | { role: "tool"; content: string; tool_call_id: string; name: string };
export interface ChatToolCompletion {
  text: string;
  toolCalls: ChatToolCall[];
  finishReason: string | null;
  /** Original ordered Gemini model response parts, including opaque thought signatures. */
  geminiParts?: GeminiModelPart[];
}
