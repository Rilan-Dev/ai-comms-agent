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
  type MailInboxFilters,
} from "./email/repository";
export { PostgresEmailFolderLabelRepository } from "./email/folder-label-repository";

export { PostgresAgentRepository } from "./agent/repository";

export { listAuditEvents, recordAuditEvent, type AuditEvent, type AuditEventInput } from "./audit/repository";
