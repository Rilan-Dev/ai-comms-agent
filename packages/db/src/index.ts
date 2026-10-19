export { testImapSmtpConnection, type ImapSmtpConnectionTestInput } from "./email/connection-test";
/**
 * @ai-comms-agent/db — PostgreSQL database access layer.
 *
 * PostgreSQL is the authoritative store. This package intentionally has no
 * Supabase runtime dependency; it works with self-hosted or managed PostgreSQL.
 */

export {
  getPostgresPool,
  getPostgresConfigFromEnv,
  isPostgresConfigured,
  isPostgresConfigured as isSupabaseConfigured,
  query,
  withTransaction,
  closePostgresPool,
  type PostgresConfig,
} from "./client";

export { type IdentityRepository } from "./identity/repository";
export { PostgresAuthRepository, type AuthCredentialRecord, type AuthSessionRecord } from "./auth";
export { InMemoryIdentityRepository, OwnerInvariantError } from "./identity/in-memory";
export { PostgresIdentityRepository, SupabaseIdentityRepository } from "./identity/supabase";

export {
  decryptCredential,
  encryptCredential,
  parseCredentialsMasterKey,
  type EncryptedEnvelope,
} from "./security";

export {
  PostgresEmailAccountRepository,
  SupabaseEmailAccountRepository,
  type CreateEmailAccountInput,
  listInboxMessages,
  listMailThreadsForOrganization,
  type MailThreadFilters,
  getMailMessageForOrganization,
  getMailThreadForOrganization,
  listMailAttachmentsForOrganization,
  getMailAttachmentForOrganization,
  updateMailReadStateForOrganization,
  archiveMailMessagesForOrganization,
  moveMailMessagesForOrganization,
  listMailFoldersForOrganization,
  createLocalDraft,
  updateLocalDraftForOrganization,
  listLocalDraftsForOrganization,
  deleteLocalDraftForOrganization,
  type CreateLocalDraftInput,
  type MailInboxFilters,
} from "./email/repository";
export { PostgresEmailFolderLabelRepository } from "./email/folder-label-repository";
export {
  createEmailAction,
  getEmailActionForOrganization,
  listPendingEmailActionsForOrganization,
  decideEmailAction,
  claimApprovedEmailAction,
  listApprovedEmailActions,
  completeEmailAction,
  recoverStaleExecutingEmailActions,
  type CreateEmailActionInput,
  type EmailActionType,
  type EmailActionStatus,
} from "./email/actions";

export { PostgresAgentRepository } from "./agent/repository";

export { listAuditEvents, listOrganizationAuditEvents, listOrganizationAuditEventsForExport, recordAuditEvent, type AuditEvent, type AuditEventFilters, type AuditEventInput } from "./audit/repository";

export { getLocalDraftForOrganization, listDraftsPendingProviderSync, markDraftProviderSyncingForOrganization, markDraftProviderSyncedForOrganization, markDraftProviderSyncErrorForOrganization, markLocalDraftSentForOrganization } from "./email/repository";

export {
  listWhatsAppAccountsForOrganization,
  getWhatsAppAccountForOrganization,
  createOrUpdateWhatsAppAccount,
  saveWhatsAppCredential,
  loadWhatsAppCredential,
  disconnectWhatsAppAccount,
  listWhatsAppMessagesForOrganization,
  getWhatsAppAccountByPhoneNumberId,
  findWhatsAppAccountByVerifyToken,
  recordWhatsAppWebhookEvent,
  upsertWhatsAppContact,
  insertWhatsAppInboundMessage,
  queueWhatsAppOutboundMessage,
  claimQueuedWhatsAppOutbound,
  recoverStaleWhatsAppOutbound,
  listPendingWhatsAppAccounts,
  updateWhatsAppAccountStatus,
  markWhatsAppOutboundSent,
  markWhatsAppOutboundFailed,
  listAgentsForWhatsAppAccount,
  applyWhatsAppProviderStatus,
  claimRoutedWhatsAppInbound,
  recoverStaleWhatsAppInbound,
  completeWhatsAppInbound,
  getWhatsAppAccountForAgent,
} from "./messaging/whatsapp-repository";

export { listScheduledJobs, getScheduledJob, createScheduledJob, updateScheduledJob, deleteScheduledJob, listScheduledJobRuns, claimDueScheduledJobs, advanceScheduledJob, completeScheduledJobRun, failScheduledJobRun, listAutomationRules, listActiveAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule, listAutomationRuns, createAutomationRun, completeAutomationRun, failAutomationRun, type ScheduledJobClaim } from "./automation/repository";

export { getOrCreateChatConversation, getChatConversation, listChatMessages, appendConversationMessage } from "./conversation/repository";

export {
  createVoiceSession,
  configureStartingVoiceSessionForOrganization,
  activateVoiceSessionForOrganization,
  incrementVoiceSessionTurnForOrganization,
  endVoiceSessionForOrganization,
  getVoiceSessionForOrganization,
  recordVoiceTelemetry,
  type CreateVoiceSessionInput,
  type VoiceSessionStatus,
} from "./voice/repository";

// AI provider configuration — multi-purpose provider credentials
// (chat / tts / stt / realtime / embedding), org-level runtime defaults,
// and per-agent overrides. See supabase/migrations/0044_ai_provider_setup.sql
// for the schema.
export {
  listProviderConfigs,
  getProviderConfig,
  getDecryptedProviderConfig,
  reuseElevenLabsRealtimeKeyForVoiceChat,
  upsertProviderConfig,
  deleteProviderConfig,
  getOrgAiRuntimeSettings,
  upsertOrgAiRuntimeSettings,
  getAgentAiSettings,
  upsertAgentAiSettings,
  type ProviderConfigRow,
  type UpsertProviderConfigInput,
  type OrgAiRuntimeSettings,
  type UpsertOrgAiRuntimeInput,
  type AgentAiSettings,
  type UpsertAgentAiSettingsInput,
} from "./ai-provider/repository";
export { createEmailHybridRetriever, type EmailVectorCandidate, type EmailVectorSearch, type EmailHybridSearchInput, type EmailHybridSearchResult, type EmailHybridSource } from "./email/hybrid-retrieval";
export { createClaraEmailVectorSearch } from "./email/clara-vector-search";
export { resolveBriefingScope, recordForegroundActivity, assignBriefingMailboxGrant, revokeBriefingMailboxGrant, type BriefingActor } from './briefings/access';
export { getBriefing, listBriefings } from './briefings/repository';
export * from './briefings/coverage';

export { listGrantedBriefingMailboxes, publishBriefingItems } from './briefings/selection';
export { loadCanonicalBriefingSources, validateCanonicalBriefingRows, type CanonicalBriefingMail, type CanonicalBriefingRow } from './briefings/canonical-sources';
