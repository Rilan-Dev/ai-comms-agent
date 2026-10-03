/**
 * @ai-comms-agent/clara-core — Clara integration boundary
 *
 * This package re-exports Clara's reusable AI capabilities from the vendored
 * submodule at vendor/clara/ without modifying Clara's source files.
 *
 * Clara source is IMMUTABLE (per clara-core/AGENTS.md §4). This package is the
 * thin host adapter layer. See:
 *   - docs/architecture/CLARA-INTEGRATION.md
 *   - docs/architecture/CLARA_REUSE_MAP.md
 *   - docs/architecture/CLARA_VOICE_INTEGRATION.md
 *
 * Phase 2 scope: foundation only. Actual Clara runtime calls (AI, RAG, voice)
 * are invoked in later phases (Phase 11+, Phase 16+).
 */

// Re-export the Clara runtime (the host-binding layer Clara provides)
export {
  claraRuntime,
  type ClaraRuntimeContext,
  type ClaraAgentTurnRequest,
  type ClaraAgentTurn,
} from "./runtime";

// Re-export key Clara types for host use
export type {
  AIProvider,
  ChatMessage,
  TokenUsage,
  ChatOptions,
  EmbedOptions,
  LLMProvider,
  EmbeddingProviderId,
  ProviderConfig,
} from "./types";

// Re-export voice types
export type {
  VoiceProvider,
  VoiceProviderService,
  ConversationalVoiceService,
} from "./types";
