/**
 * Clara type re-exports
 *
 * Re-exports key types from Clara's ai-core and voice-core modules.
 * These are type-only imports (no runtime dependency) used by the host
 * application to interact with Clara's interfaces.
 */

// AI core types
// @ts-expect-error Clara is an optional git submodule; structural host checks must compile without its checkout.
export type {
  AIProvider,
  ChatMessage,
  TokenUsage,
  ChatOptions,
  EmbedOptions,
  LLMProvider,
  EmbeddingProviderId,
  ProviderConfig,
} from "../../../vendor/clara/clara-core/source/src/modules/ai-core/types";

// Voice core types
// @ts-expect-error Clara is an optional git submodule; structural host checks must compile without its checkout.
export type {
  VoiceProvider,
  VoiceProviderService,
  ConversationalVoiceService,
} from "../../../vendor/clara/clara-core/source/src/modules/voice-core/types";

// RAG grounding types
// @ts-expect-error Clara is an optional git submodule; structural host checks must compile without its checkout.
export type {
  GroundingRagMode,
  GroundingRequest,
  GroundedSource,
  GroundedContext,
} from "../../../vendor/clara/clara-core/source/src/modules/rag/grounding";
