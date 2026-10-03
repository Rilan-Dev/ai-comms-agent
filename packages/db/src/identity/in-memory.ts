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

/**
 * Thrown when a membership operation would violate the owner invariant
 * (per DOMAIN_MODEL.md §2.1: "An organization must have exactly one owner
 * at all times").
 *
 * Two violation types:
 *   - "multiple_owners": attempting to add/promote a second active owner
 *   - "no_owner": attempting to demote/suspend/revoke the final active owner
 */
export class OwnerInvariantError extends Error {
  constructor(
    public readonly violation: "multiple_owners" | "no_owner",
    message?: string,
  ) {
    super(message ?? `Owner invariant violated: ${violation}`);
    this.name = "OwnerInvariantError";
  }
}

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

    // Owner invariant (per DOMAIN_MODEL.md §2.1): an organization must have
    // exactly one owner at all times. Adding a second active owner is rejected.
    if (input.role === "owner" && (input.status ?? "active") === "active") {
      const existingOwner = await this.getActiveOwner(input.organizationId);
      if (existingOwner) {
        throw new OwnerInvariantError(
          "multiple_owners",
          "Organization already has an active owner. Transfer ownership instead of adding a second owner.",
        );
      }
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

    // Owner invariant: cannot suspend/revoke the final active owner.
    if (m.role === "owner" && m.status === "active" && status !== "active") {
      const owners = await this.getActiveOwners(m.organizationId);
      if (owners.length <= 1) {
        throw new OwnerInvariantError(
          "no_owner",
          "Cannot suspend or revoke the final active owner. Transfer ownership first.",
        );
      }
    }

    m.status = status;
    m.updatedAt = new Date().toISOString();
    return m;
  }

  async updateMembershipRole(id: MembershipId, role: MembershipRole): Promise<OrganizationMembership | null> {
    const m = this.memberships.get(id);
    if (!m) return null;

    // Owner invariant: cannot demote the final active owner to a non-owner role.
    if (m.role === "owner" && role !== "owner" && m.status === "active") {
      const owners = await this.getActiveOwners(m.organizationId);
      if (owners.length <= 1) {
        throw new OwnerInvariantError(
          "no_owner",
          "Cannot demote the final active owner. Transfer ownership to another member first.",
        );
      }
    }

    // Owner invariant: cannot promote a second member to owner if an active owner exists.
    if (role === "owner" && m.role !== "owner" && m.status === "active") {
      const existingOwner = await this.getActiveOwner(m.organizationId);
      if (existingOwner && existingOwner.id !== m.id) {
        throw new OwnerInvariantError(
          "multiple_owners",
          "Organization already has an active owner. Transfer ownership instead of promoting a second owner.",
        );
      }
    }

    m.role = role;
    m.updatedAt = new Date().toISOString();
    return m;
  }

  // -------------------------------------------------------------------
  // Owner invariant helpers (private)
  // -------------------------------------------------------------------

  /** Get the single active owner of an organization, or null if none. */
  private async getActiveOwner(orgId: OrganizationId): Promise<OrganizationMembership | null> {
    const owners = await this.getActiveOwners(orgId);
    return owners[0] ?? null;
  }

  /** Get all active owners of an organization. */
  private async getActiveOwners(orgId: OrganizationId): Promise<OrganizationMembership[]> {
    const result: OrganizationMembership[] = [];
    for (const m of this.memberships.values()) {
      if (m.organizationId === orgId && m.role === "owner" && m.status === "active") {
        result.push(m);
      }
    }
    return result;
  }

  // -------------------------------------------------------------------
  // Ownership transfer (atomic, preserves exactly-one-owner invariant)
  // -------------------------------------------------------------------

  async transferOwnership(
    orgId: OrganizationId,
    newOwnerId: UserId,
    newOwnerRole: MembershipRole = "admin",
  ): Promise<OrganizationMembership[]> {
    // Validate target is an active member
    const targetMembership = await this.getMembership(orgId, newOwnerId);
    if (!targetMembership) {
      throw new OwnerInvariantError("no_owner", "Target user is not a member of this organization.");
    }
    if (targetMembership.status !== "active") {
      throw new OwnerInvariantError("no_owner", `Target membership is ${targetMembership.status}.`);
    }

    // Validate there is a current active owner
    const currentOwner = await this.getActiveOwner(orgId);
    if (!currentOwner) {
      throw new OwnerInvariantError("no_owner", "Organization has no active owner (invalid state).");
    }

    // If target is already the owner, no-op
    if (targetMembership.role === "owner") {
      return [targetMembership];
    }

    // Atomic transfer: demote current owner, promote target
    // Both operations are performed without the invariant checks (private field access)
    // because this is the one operation that legitimately transitions ownership.
    const now = new Date().toISOString();
    currentOwner.role = newOwnerRole;
    currentOwner.updatedAt = now;
    targetMembership.role = "owner";
    targetMembership.updatedAt = now;

    return [currentOwner, targetMembership];
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
