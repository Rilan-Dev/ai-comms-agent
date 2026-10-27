/**
 * Identity, organization, and RBAC domain types.
 *
 * Per docs/architecture/DOMAIN_MODEL.md §2 (Identity & Tenancy context) and
 * docs/architecture/SECURITY_MODEL.md §4 (Agent permissions / RBAC).
 *
 * Phase 3 scope: identity abstraction + organization/membership/role/permission
 * model + server-side authorization. Authentication is application-owned and
 * provider-neutral: PostgreSQL-backed password credentials + opaque sessions
 * resolve the authenticated user before authorization is evaluated.
 */

// ============================================================================
// Branded IDs (lightweight type-safety, per Phase 3 handoff §21)
// ============================================================================

export type UserId = string & { readonly __brand: "UserId" };
export type OrganizationId = string & { readonly __brand: "OrganizationId" };
export type MembershipId = string & { readonly __brand: "MembershipId" };
export type RoleId = string & { readonly __brand: "RoleId" };
export type PermissionId = string & { readonly __brand: "PermissionId" };

export const asUserId = (s: string): UserId => s as UserId;
export const asOrganizationId = (s: string): OrganizationId => s as OrganizationId;
export const asMembershipId = (s: string): MembershipId => s as MembershipId;
export const asRoleId = (s: string): RoleId => s as RoleId;
export const asPermissionId = (s: string): PermissionId => s as PermissionId;

// ============================================================================
// Enumerations
// ============================================================================

export type MembershipRole = "owner" | "admin" | "member" | "viewer";

/**
 * A role that is NOT "owner". Used by transferOwnership to make it
 * type-safe — the compiler rejects passing "owner" as the demotion role.
 */
export type NonOwnerRole = Exclude<MembershipRole, "owner">;

export type MembershipStatus = "active" | "suspended" | "invited";

export type UserStatus = "active" | "suspended" | "deleted";

export type OrganizationStatus = "active" | "suspended" | "archived";

// ============================================================================
// Entities
// ============================================================================

export interface User {
  id: UserId;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: OrganizationId;
  name: string;
  slug: string;
  /**
   * Optional workspace display name used by the web shell (navigation bar and
   * browser tab). When null or empty the organization name is displayed.
   */
  productName: string | null;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  id: MembershipId;
  organizationId: OrganizationId;
  userId: UserId;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: RoleId;
  organizationId: OrganizationId;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  createdAt: string;
}

export interface Permission {
  id: PermissionId;
  name: string;
  description: string | null;
}

// ============================================================================
// Permission Catalogue (system-defined, per SECURITY_MODEL.md §4.2)
// ============================================================================

export const PERMISSION_CATALOGUE = [
  // Organization
  { name: "organization.read", description: "View organization details" },
  { name: "organization.update", description: "Update organization settings" },
  { name: "organization.members.read", description: "View organization members" },
  { name: "organization.members.manage", description: "Invite, remove, or change member roles" },
  // Users
  { name: "users.read", description: "View user profiles within the organization" },
  { name: "users.manage", description: "Manage user accounts" },
  // Audit
  { name: "audit.read", description: "View audit log" },
  // Settings
  { name: "settings.read", description: "View organization settings" },
  { name: "settings.manage", description: "Manage organization settings" },
  { name: "briefing.access.manage", description: "Assign and revoke personal briefing mailbox access" },
  // WhatsApp feature permissions (added with the messaging feature phase).
  { name: "email.read", description: "Read connected email accounts and messages through agent tools" },
  // Owner/admin identities are granted this through explicit system-role
  // defaults below. Other roles cannot obtain it by selecting agent tools.
  { name: "email.write", description: "Create email drafts and request human approval to send through agent tools" },
  { name: "whatsapp.read", description: "Read connected WhatsApp conversations and approval requests" },
  { name: "whatsapp.send", description: "Request WhatsApp outbound messages through human approval" },
  // Scheduled AI agent feature: the agent may manage its own durable
  // schedules through host tools (create/read/edit/delete).
  { name: "schedules.read", description: "View scheduled AI agent tasks through agent tools" },
  { name: "schedules.manage", description: "Create, edit, pause and delete scheduled AI agent tasks through agent tools" },
] as const;

export type PermissionName = (typeof PERMISSION_CATALOGUE)[number]["name"];

// ============================================================================
// Role-Permission Mapping (system roles, per SECURITY_MODEL.md §4.1)
// ============================================================================

export const SYSTEM_ROLE_PERMISSIONS: Record<MembershipRole, readonly PermissionName[]> = {
  owner: [
    "organization.read",
    "organization.update",
    "organization.members.read",
    "organization.members.manage",
    "users.read",
    "users.manage",
    "audit.read",
    "settings.read",
    "settings.manage",
    "briefing.access.manage",
    "email.read",
    "email.write",
    "whatsapp.read",
    "whatsapp.send",
    "schedules.read",
    "schedules.manage",
  ],
  admin: [
    "organization.read",
    "organization.members.read",
    "users.read",
    "audit.read",
    "settings.read",
    "settings.manage",
    "briefing.access.manage",
    "email.read",
    "email.write",
    "whatsapp.read",
    "whatsapp.send",
    "schedules.read",
    "schedules.manage",
  ],
  member: [
    "organization.read",
    "users.read",
    "email.read",
    "whatsapp.read",
    "schedules.read",
  ],
  viewer: [
    "organization.read",
  ],
} as const;

// ============================================================================
// Auth Subject (the resolved identity context for a request)
// ============================================================================

export interface AuthSubject {
  user: User;
  /** Memberships for the current organization context only (resolved server-side). */
  membership: OrganizationMembership | null;
  /** Effective permissions in the current organization context. */
  permissions: ReadonlySet<PermissionName>;
}

// ============================================================================
// Identity Adapter (authentication boundary, per Phase 3 handoff §16)
// ============================================================================

/**
 * The application owns both authentication and authorization. The production
 * adapter resolves a PostgreSQL-backed opaque session. Development may use the
 * explicitly guarded dev adapter for local UI work.
 */
export interface IdentityAdapter {
  /**
   * Resolve the authenticated user from a request. Returns null if not
   * authenticated. Does NOT throw for unauthenticated requests.
   */
  resolveUser(request: Request): Promise<User | null>;
}

// ============================================================================
// Authorization Errors
// ============================================================================

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(
    public readonly reason: "not_member" | "missing_permission" | "suspended" | "insufficient_role",
    message?: string,
  ) {
    super(message ?? `Forbidden: ${reason}`);
    this.name = "ForbiddenError";
  }
}
