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
}
