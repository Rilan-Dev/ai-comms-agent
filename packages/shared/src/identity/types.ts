/**
 * Identity, organization, and RBAC domain types.
 *
 * Per docs/architecture/DOMAIN_MODEL.md §2 (Identity & Tenancy context) and
 * docs/architecture/SECURITY_MODEL.md §4 (Agent permissions / RBAC).
 *
 * Phase 3 scope: identity abstraction + organization/membership/role/permission
 * model + server-side authorization. No production authentication — the
 * application owns authorization; authentication is delegated to a future
 * identity provider via the IdentityAdapter interface.
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
  ],
  admin: [
    "organization.read",
    "organization.members.read",
    "users.read",
    "audit.read",
    "settings.read",
    "settings.manage",
  ],
  member: [
    "organization.read",
    "users.read",
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
 * The application owns authorization. Authentication is delegated to a future
 * identity provider (Supabase Auth, Auth0, etc.) via this interface.
 *
 * Phase 3 uses a dev-only stub implementation (clearly marked). Production
 * implementations will be added in a future phase.
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
