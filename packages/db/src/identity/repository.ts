/**
 * Identity repository — database-agnostic interface for identity/org/RBAC queries.
 *
 * Phase 3 scope: the interface + an in-memory implementation (for tests and
 * dev). A Supabase-backed implementation will be added in Phase 4 when the
 * database is provisioned.
 *
 * Per Phase 3 handoff §14: no production Supabase provisioning. The SQL
 * migration (supabase/migrations/0001_identity_rbac.sql) is a schema artifact.
 */

import type {
  UserId,
  OrganizationId,
  MembershipId,
  MembershipRole,
  MembershipStatus,
  User,
  Organization,
  OrganizationMembership,
  PermissionName,
} from "@ai-comms-agent/shared";

export interface IdentityRepository {
  // Users
  getUserById(id: UserId): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(input: { email: string; name?: string | null }): Promise<User>;

  // Organizations
  getOrganizationById(id: OrganizationId): Promise<Organization | null>;
  getOrganizationBySlug(slug: string): Promise<Organization | null>;
  createOrganization(input: { name: string; slug: string }): Promise<Organization>;

  // Memberships
  getMembership(orgId: OrganizationId, userId: UserId): Promise<OrganizationMembership | null>;
  getMembershipsForUser(userId: UserId): Promise<OrganizationMembership[]>;
  getMembershipsForOrg(orgId: OrganizationId): Promise<OrganizationMembership[]>;
  createMembership(input: {
    organizationId: OrganizationId;
    userId: UserId;
    role: MembershipRole;
    status?: MembershipStatus;
  }): Promise<OrganizationMembership>;
  updateMembershipStatus(id: MembershipId, status: MembershipStatus): Promise<OrganizationMembership | null>;
  updateMembershipRole(id: MembershipId, role: MembershipRole): Promise<OrganizationMembership | null>;

  // Permissions
  getPermissionsForRole(orgId: OrganizationId, role: MembershipRole): Promise<PermissionName[]>;

  // Owner invariant (per DOMAIN_MODEL.md §2.1: "exactly one owner at all times")
  /**
   * Atomically transfer ownership from the current owner to a new member.
   * The current owner is demoted to `newOwnerRole` (default: "admin") and
   * the target member is promoted to "owner". This is the only way to change
   * ownership without violating the exactly-one-owner invariant.
   *
   * Throws OwnerInvariantError if:
   *   - the target member is not an active member of the organization
   *   - the target member is already the owner
   *   - there is no current active owner (invalid state)
   */
  transferOwnership(orgId: OrganizationId, newOwnerId: UserId, newOwnerRole?: MembershipRole): Promise<OrganizationMembership[]>;
}
