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
  Tool,
  ToolContext,
  ToolResult,
  Intent,
} from "./agent/types";

export { INTENT_TAXONOMY } from "./agent/intents";

// Email provider types
export type {
  EmailProvider,
  EmailProviderType,
  EmailProviderCapability,
  CapabilitySet,
  EmailFolder,
  EmailLabel,
  EmailMessage,
  EmailThread,
  EmailAccount,
  SyncState,
  SyncResult,
  DraftParams,
  DraftRef,
  SentMessageRef,
  SearchQuery,
  ListOptions,
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
