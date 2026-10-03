/**
 * In-memory identity repository implementation.
 *
 * Used for:
 *   - Automated tests (no real database required)
 *   - Local development (until Supabase is provisioned in Phase 4)
 *
 * NOT for production. Production uses the Supabase-backed implementation
 * (to be added in Phase 4).
 *
 * The in-memory store validates the same constraints as the SQL migration
 * (unique slug, unique email, unique membership per org+user) so that tests
 * exercise real integrity rules.
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
import {
  asUserId,
  asOrganizationId,
  asMembershipId,
  SYSTEM_ROLE_PERMISSIONS,
} from "@ai-comms-agent/shared";
import type { IdentityRepository } from "./repository";

interface InMemoryUser extends User {}
interface InMemoryOrganization extends Organization {}
interface InMemoryMembership extends OrganizationMembership {}

export class InMemoryIdentityRepository implements IdentityRepository {
  private users = new Map<UserId, InMemoryUser>();
  private organizations = new Map<OrganizationId, InMemoryOrganization>();
  private memberships = new Map<MembershipId, InMemoryMembership>();
  private emailIndex = new Map<string, UserId>(); // lowercase email → user id
  private slugIndex = new Map<string, OrganizationId>(); // lowercase slug → org id
  private orgUserIndex = new Map<string, MembershipId>(); // `${orgId}:${userId}` → membership id

  constructor() {
    // Private — use create() factory
  }

  static create(): InMemoryIdentityRepository {
    return new InMemoryIdentityRepository();
  }

  // -------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------

  async getUserById(id: UserId): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const id = this.emailIndex.get(email.toLowerCase());
    if (!id) return null;
    return this.users.get(id) ?? null;
  }

  async createUser(input: { email: string; name?: string | null }): Promise<User> {
    const email = input.email.toLowerCase();
    if (this.emailIndex.has(email)) {
      throw new Error(`User with email ${input.email} already exists`);
    }
    const id = asUserId(crypto.randomUUID());
    const now = new Date().toISOString();
    const user: InMemoryUser = {
      id,
      email: input.email,
      name: input.name ?? null,
      avatarUrl: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    this.emailIndex.set(email, id);
    return user;
  }

  // -------------------------------------------------------------------
  // Organizations
  // -------------------------------------------------------------------

  async getOrganizationById(id: OrganizationId): Promise<Organization | null> {
    return this.organizations.get(id) ?? null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const id = this.slugIndex.get(slug.toLowerCase());
    if (!id) return null;
    return this.organizations.get(id) ?? null;
  }

  async createOrganization(input: { name: string; slug: string }): Promise<Organization> {
    const slug = input.slug.toLowerCase();
    if (this.slugIndex.has(slug)) {
      throw new Error(`Organization with slug ${input.slug} already exists`);
    }
    const id = asOrganizationId(crypto.randomUUID());
    const now = new Date().toISOString();
    const org: InMemoryOrganization = {
      id,
      name: input.name,
      slug: input.slug,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(id, org);
    this.slugIndex.set(slug, id);
    return org;
  }

  // -------------------------------------------------------------------
  // Memberships
  // -------------------------------------------------------------------

  async getMembership(orgId: OrganizationId, userId: UserId): Promise<OrganizationMembership | null> {
    const key = `${orgId}:${userId}`;
    const id = this.orgUserIndex.get(key);
    if (!id) return null;
    return this.memberships.get(id) ?? null;
  }

  async getMembershipsForUser(userId: UserId): Promise<OrganizationMembership[]> {
    const result: OrganizationMembership[] = [];
    for (const m of this.memberships.values()) {
      if (m.userId === userId) result.push(m);
    }
    return result;
  }

  async getMembershipsForOrg(orgId: OrganizationId): Promise<OrganizationMembership[]> {
    const result: OrganizationMembership[] = [];
    for (const m of this.memberships.values()) {
      if (m.organizationId === orgId) result.push(m);
    }
    return result;
  }

  async createMembership(input: {
    organizationId: OrganizationId;
    userId: UserId;
    role: MembershipRole;
    status?: MembershipStatus;
  }): Promise<OrganizationMembership> {
    const key = `${input.organizationId}:${input.userId}`;
    if (this.orgUserIndex.has(key)) {
      throw new Error("User is already a member of this organization");
    }
    const id = asMembershipId(crypto.randomUUID());
    const now = new Date().toISOString();
    const membership: InMemoryMembership = {
      id,
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.set(id, membership);
    this.orgUserIndex.set(key, id);
    return membership;
  }

  async updateMembershipStatus(id: MembershipId, status: MembershipStatus): Promise<OrganizationMembership | null> {
    const m = this.memberships.get(id);
    if (!m) return null;
    m.status = status;
    m.updatedAt = new Date().toISOString();
    return m;
  }

  async updateMembershipRole(id: MembershipId, role: MembershipRole): Promise<OrganizationMembership | null> {
    const m = this.memberships.get(id);
    if (!m) return null;
    m.role = role;
    m.updatedAt = new Date().toISOString();
    return m;
  }

  // -------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------

  async getPermissionsForRole(_orgId: OrganizationId, role: MembershipRole): Promise<PermissionName[]> {
    // System roles use the static mapping. Custom roles (future) would query
    // the role_permissions table.
    return [...SYSTEM_ROLE_PERMISSIONS[role]];
  }

  // -------------------------------------------------------------------
  // Test helpers (NOT part of the IdentityRepository interface)
  // -------------------------------------------------------------------

  /** Clear all data. For test isolation. */
  clear(): void {
    this.users.clear();
    this.organizations.clear();
    this.memberships.clear();
    this.emailIndex.clear();
    this.slugIndex.clear();
    this.orgUserIndex.clear();
  }
}
