/**
 * @ai-comms-agent/clara-core
 *
 * Local Clara integration boundary. The ai-reusable-libraries repository is
 * reference-only; it is not imported, copied, or compiled by this application.
 */
export { indexEmailForClara } from "./email-indexing";

export {
  claraRuntime,
  createProvider,
  type ClaraRuntimeContext,
  type ClaraAgentTurnRequest,
  type ClaraAgentTurn,
} from "./runtime";

export type {
  AIProvider,
  ChatMessage,
  TokenUsage,
  ChatOptions,
  EmbedOptions,
  LLMProvider,
  EmbeddingProviderId,
  ProviderConfig,
  VoiceProvider,
  VoiceProviderService,
  ConversationalVoiceService,
  GroundingRagMode,
  GroundingRequest,
  GroundedSource,
  GroundedContext,
} from "./types";
