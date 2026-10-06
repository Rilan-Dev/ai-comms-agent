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
  recordWhatsAppWebhookEvent,
  upsertWhatsAppContact,
  insertWhatsAppInboundMessage,
  queueWhatsAppOutboundMessage,
  listQueuedWhatsAppOutbound,
  listPendingWhatsAppAccounts,
  updateWhatsAppAccountStatus,
  markWhatsAppOutboundSent,
  markWhatsAppOutboundFailed,
  listAgentsForWhatsAppAccount,
  applyWhatsAppProviderStatus,
  claimRoutedWhatsAppInbound,
  completeWhatsAppInbound,
  getWhatsAppAccountForAgent,
} from "./messaging/whatsapp-repository";

export { listScheduledJobs, getScheduledJob, createScheduledJob, updateScheduledJob, deleteScheduledJob, listScheduledJobRuns, claimDueScheduledJobs, advanceScheduledJob, completeScheduledJobRun, failScheduledJobRun, listAutomationRules, listActiveAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule, listAutomationRuns, createAutomationRun, completeAutomationRun, failAutomationRun, type ScheduledJobClaim } from "./automation/repository";

export { getOrCreateChatConversation, listChatMessages, appendConversationMessage } from "./conversation/repository";

export {
  createVoiceSession,
  activateVoiceSessionForOrganization,
  incrementVoiceSessionTurnForOrganization,
  endVoiceSessionForOrganization,
  getVoiceSessionForOrganization,
  recordVoiceTelemetry,
  type CreateVoiceSessionInput,
  type VoiceSessionStatus,
} from "./voice/repository";
