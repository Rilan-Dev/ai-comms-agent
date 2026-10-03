/**
 * Clara type re-exports
 *
 * Re-exports key types from Clara's ai-core and voice-core modules.
 * These are type-only imports (no runtime dependency) used by the host
 * application to interact with Clara's interfaces.
 */

// AI core types
export type {
  AIProvider,
  ChatMessage,
  TokenUsage,
  ChatOptions,
  EmbedOptions,
  LLMProvider,
  EmbeddingProviderId,
  ProviderConfig,
} from "@/modules/ai-core/types";

// Voice core types
export type {
  VoiceProvider,
  VoiceProviderService,
  ConversationalVoiceService,
} from "@/modules/voice-core/types";

// RAG grounding types
export type {
  GroundingRagMode,
  GroundingRequest,
  GroundedSource,
  GroundedContext,
} from "@/modules/rag/grounding";
