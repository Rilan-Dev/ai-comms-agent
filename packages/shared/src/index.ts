/**
 * @ai-comms-agent/shared — shared types, schemas, and domain primitives
 *
 * This package is the canonical source for cross-app types (web + worker).
 * Per docs/architecture/DOMAIN_MODEL.md and docs/specs/TOOL-CONTRACTS.md.
 */

// Agent runtime types
export type {
  AgentRequest,
  AgentResponse,
  ToolSensitivity,
  EmailToolDescriptor,
  Tool,
  ToolContext,
  ToolResult,
  Intent,
} from "./agent/types";

export { INTENT_TAXONOMY } from "./agent/intents";
export { ToolRegistry, type AgentToolAllowlist, type ToolValidationResult } from "./agent/registry";
export { EMAIL_TOOL_CATALOG, listEmailToolDescriptors } from "./agent/mail-operations";
export { AUTONOMOUS_SEND_POLICY_KEY, AUTO_APPROVED_MARKER, isAutonomousSendEnabled } from "./agent/autonomous-send";

// Email provider types
export type {
  EmailProvider,
  EmailCredentials,
  EmailProviderType,
  EmailProviderCapability,
  CapabilitySet,
  EmailFolder,
  EmailLabel,
  EmailMessage,
  EmailMessageFlags,
  EmailThread,
  EmailAccount,
  SyncState,
  SyncResult,
  DraftParams,
  DraftRef,
  SentMessageRef,
  SearchQuery,
  ListOptions,
  AttachmentRef,
} from "./email/provider";

export { CapabilityNotSupported, CapabilityNotSupported as CapabilityNotSupportedError } from "./email/provider";

// Messaging channel types
export type {
  MessagingChannel,
  MessagingCapability,
  MessagingCredentials,
  InboundWebhookEvent,
  OutboundMessage,
  Contact,
  Template,
  TemplateParams,
  MessagingCapabilitySet,
} from "./messaging/channel";

// Identity, organization, and RBAC types (Phase 3)
export type {
  UserId,
  OrganizationId,
  MembershipId,
  RoleId,
  PermissionId,
  MembershipRole,
  NonOwnerRole,
  MembershipStatus,
  UserStatus,
  OrganizationStatus,
  User,
  Organization,
  OrganizationMembership,
  Role,
  Permission,
  PermissionName,
  AuthSubject,
  IdentityAdapter,
} from "./identity/types";

export {
  asUserId,
  asOrganizationId,
  asMembershipId,
  asRoleId,
  asPermissionId,
  PERMISSION_CATALOGUE,
  SYSTEM_ROLE_PERMISSIONS,
  UnauthorizedError,
  ForbiddenError,
} from "./identity/types";

export { EmailProviderRegistry, type EmailProviderFactory } from "./email/registry";

export { EMAIL_CAPABILITIES, emptyCapabilitySet, normalizeCapabilitySet, assertCapability } from "./email/capabilities";

// RFC822 / MIME message parser — used by the Zoho adapter (which fetches
// raw RFC822 source from /originalmessage) and the IMAP adapter (which
// fetches raw RFC822 source via FETCH BODY[]). Parses subject/from/to/body
// + handles multipart MIME + QP/Base64 decoding.
export { parseRfc822, type ParsedEmail } from "./email/rfc822-parser";

// Fail-closed email HTML ingest / legacy-row preview quarantine.
export { sanitizeEmailHtml, verifiedEmailHtml } from "./email/html-sanitizer";

export type { AgentStatus, DeploymentEnvironment, AgentEmailAccountRole, Agent, AgentVersion, AgentDeployment, AgentPolicy, AgentEmailBinding, AgentWhatsAppBinding } from "./agent/domain";

export type { AgentExecutionSource, AgentExecutionRequest, AgentExecutionDispatchResult, ProductActionResult } from "./agent/execution";

// Realtime voice transport contract — host adapter only; Clara owns provider transport.
export type { VoiceTransportState, VoiceTranscriptEvent, VoiceTransportSession, VoiceTransportAdapter } from "./voice";
export { isCurrentVoiceSequence } from "./voice";

// AI model catalog (chat / TTS / STT / realtime / embedding) — single source
// of truth for provider+model selection across the platform. SERVER-ONLY.
export type {
  ChatProvider,
  VoiceChatProvider,
  RealtimeProvider,
  EmbeddingProvider,
  AiPurpose,
  ChatModelEntry,
  TtsModelEntry,
  SttModelEntry,
  RealtimeModelEntry,
  EmbeddingModelEntry,
} from "./ai/model-catalog";
export {
  OPENAI_CHAT_MODELS,
  GEMINI_CHAT_MODELS,
  SARVAM_CHAT_MODELS,
  ALL_CHAT_MODELS,
  ELEVENLABS_TTS_MODELS,
  SARVAM_TTS_MODELS,
  ALL_TTS_MODELS,
  ELEVENLABS_STT_MODELS,
  SARVAM_STT_MODELS,
  ALL_STT_MODELS,
  REALTIME_MODELS,
  OPENAI_REALTIME_VOICES,
  OPENAI_EMBEDDING_MODELS,
  GEMINI_EMBEDDING_MODELS,
  ALL_EMBEDDING_MODELS,
  CHAT_PROVIDER_LABELS,
  VOICE_CHAT_PROVIDER_LABELS,
  REALTIME_PROVIDER_LABELS,
  EMBEDDING_PROVIDER_LABELS,
  findChatModel,
  findTtsModel,
  findSttModel,
  findRealtimeModel,
  findEmbeddingModel,
  isKnownChatModel,
  isKnownTtsModel,
  isKnownSttModel,
  isKnownRealtimeModel,
  isKnownEmbeddingModel,
  defaultChatModelFor,
  defaultEmbeddingModelFor,
  embeddingDimensionFor,
} from "./ai/model-catalog";

export type { TrustedBriefingPrincipal, BriefingPeriod, BriefingRequest, EffectiveBriefingScope, BriefingSource, BriefingManifest, BriefingItem, BriefingRead, BriefingListOptions, BriefingList } from './briefings/types';
export * from './briefings/selection';

// Routines are preview contracts, not authority to execute or deliver.
export type { RoutineTrigger, RoutineScheduleTrigger, DigestWindow, RoutineOccurrencePreview, RoutineDestination, RoutineDraft, RoutineProposalPreview } from './routines/types';

// Shared schedule-time calculation for API persistence and worker dispatch.
export { matchesCron, nextCronFire } from "./scheduling/cron";
export type { OperationResult } from "./operations/result";
export { operationResultFromToolCall } from "./operations/result";
export type { EmailBodyReview } from "./operations/email-content";
export { reviewExplicitEmailBody } from "./operations/email-content";
export type { WhatsAppReadiness } from "./operations/whatsapp-readiness";
export { deriveWhatsAppReadiness } from "./operations/whatsapp-readiness";

export {replyMessageId,replyReferences,emailReplyMetadata} from './email/reply-metadata';

export {requiresHumanApproval,hasApprovalRequestDirective} from './operations/human-approval';
export {AGENT_AI_CONFIGURATION_COLUMNS,AGENT_AI_CONFIGURATION_FIELDS,LEGACY_AGENT_CONFIGURATION_FIELDS,captureAgentConfigurationEdit,captureAgentConfigurationSnapshot,validateAgentConfigurationSnapshot,diffAgentConfiguration,restoreProtectedConfigurationValues} from './agent/configuration-revision';
export type {AgentAiConfiguration,AgentConfigurationSnapshotV1,ConfigurationDiff} from './agent/configuration-revision';

export {turnAllowsTool,turnRequiresHumanApproval,turnAllowsEmailAccount,turnAllowsWhatsAppAccount} from './agent/configuration-turn';
