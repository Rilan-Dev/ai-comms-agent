/** @ts-nocheck
 * Clara type re-exports
 *
 * Re-exports key types from Clara's ai-core and voice-core modules.
 * These are type-only imports (no runtime dependency) used by the host
 * application to interact with Clara's interfaces.
 *
 * The vendored Clara submodule is intentionally optional in host checkouts.
 * @ts-nocheck is used at this immutable-boundary re-export so downstream
 * package consumers do not turn an absent optional submodule into a host
 * typecheck failure. When the submodule is present, these remain the exact
 * Clara contracts.
 */

// AI core types
// @ts-ignore — the optional Clara submodule may be absent in host checkouts.
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
// @ts-ignore — the optional Clara submodule may be absent in host checkouts.
export type {
  VoiceProvider,
  VoiceProviderService,
  ConversationalVoiceService,
} from "../../../vendor/clara/clara-core/source/src/modules/voice-core/types";

// RAG grounding types
// @ts-ignore — the optional Clara submodule may be absent in host checkouts.
export type {
  GroundingRagMode,
  GroundingRequest,
  GroundedSource,
  GroundedContext,
} from "../../../vendor/clara/clara-core/source/src/modules/rag/grounding";
