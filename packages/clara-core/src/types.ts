/**
 * Local Clara contracts.
 *
 * These contracts are intentionally self-contained. The ai-reusable-libraries
 * repository under vendor/clara is a reference source only and is never a
 * runtime/build dependency of this application.
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

export interface ClaraRuntimeContext {
  orgId: string | null;
  agentId: string | null;
  kbId: string;
  userId?: string | null;
  sessionId?: string | null;
}

export interface ClaraAgentTurnRequest extends ClaraRuntimeContext {
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

export interface ClaraAgentTurn {
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
}
export type ToolChatMessage =
  | ChatMessage
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string; name: string };
export interface ChatToolCompletion {
  text: string;
  toolCalls: ChatToolCall[];
  finishReason: string | null;
}
