import { createSupabaseServiceClient } from "../client";
import type {
  IdentityRepository, OrganizationWithOwner
} from "./repository";
import type {
  UserId, OrganizationId, MembershipId, MembershipRole, NonOwnerRole,
  MembershipStatus, User, Organization, OrganizationMembership, PermissionName
} from "@ai-comms-agent/shared";
import {
  asUserId, asOrganizationId, asMembershipId, SYSTEM_ROLE_PERMISSIONS
} from "@ai-comms-agent/shared";

type Row = Record<string, unknown>;

function user(row: Row): User {
  return {
    id: asUserId(String(row.id)),
    email: String(row.email),
    name: (row.name as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    status: row.status as User["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function organization(row: Row): Organization {
  return {
    id: asOrganizationId(String(row.id)),
    name: String(row.name),
    slug: String(row.slug),
    status: row.status as Organization["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function membership(row: Row): OrganizationMembership {
  return {
    id: asMembershipId(String(row.id)),
    organizationId: asOrganizationId(String(row.organization_id)),
    userId: asUserId(String(row.user_id)),
    role: row.role as MembershipRole,
    status: row.status as MembershipStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Production identity repository.
 *
 * This adapter intentionally uses the Supabase server/service client. API
 * authorization remains mandatory before calling it; the service client is
 * never exported to browser code.
 */
export class SupabaseIdentityRepository implements IdentityRepository {
  private readonly db = createSupabaseServiceClient();

  async getUserById(id: UserId): Promise<User | null> {
    const { data, error } = await this.db.from("users").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? user(data) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.db.from("users").select("*").ilike("email", email).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? user(data) : null;
  }

  async createUser(input: { email: string; name?: string | null }): Promise<User> {
    const { data, error } = await this.db.from("users").insert({ email: input.email, name: input.name ?? null }).select("*").single();
    if (error) throw error;
    return user(data);
  }

  async getOrganizationById(id: OrganizationId): Promise<Organization | null> {
    const { data, error } = await this.db.from("organizations").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? organization(data) : null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const { data, error } = await this.db.from("organizations").select("*").eq("slug", slug).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? organization(data) : null;
  }

  async createOrganization(input: { name: string; slug: string }): Promise<Organization> {
    throw new Error("createOrganization is internal and disabled in the production repository; use createOrganizationWithOwner");
  }

  async createOrganizationWithOwner(input: {
    name: string; slug: string; ownerId: UserId;
  }): Promise<OrganizationWithOwner> {
    const { data, error } = await this.db.rpc("create_organization_with_owner", {
      p_name: input.name, p_slug: input.slug, p_owner_id: input.ownerId,
    });
    if (error) throw error;
    const result = data as { organization: Row; membership: Row };
    return { organization: organization(result.organization), ownerMembership: membership(result.membership) };
  }

  async getMembership(orgId: OrganizationId, userId: UserId): Promise<OrganizationMembership | null> {
    const { data, error } = await this.db.from("organization_memberships").select("*").eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? membership(data) : null;
  }

  async getMembershipsForUser(userId: UserId): Promise<OrganizationMembership[]> {
    const { data, error } = await this.db.from("organization_memberships").select("*").eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map(membership);
  }

  async getMembershipsForOrg(orgId: OrganizationId): Promise<OrganizationMembership[]> {
    const { data, error } = await this.db.from("organization_memberships").select("*").eq("organization_id", orgId);
    if (error) throw error;
    return (data ?? []).map(membership);
  }

  async createMembership(input: {
    organizationId: OrganizationId; userId: UserId; role: MembershipRole; status?: MembershipStatus;
  }): Promise<OrganizationMembership> {
    const { data, error } = await this.db.from("organization_memberships").insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      role: input.role,
      status: input.status ?? "active",
    }).select("*").single();
    if (error) throw error;
    return membership(data);
  }

  async updateMembershipStatus(id: MembershipId, status: MembershipStatus): Promise<OrganizationMembership | null> {
    const { data, error } = await this.db.from("organization_memberships").update({ status }).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    return data ? membership(data) : null;
  }

  async updateMembershipRole(id: MembershipId, role: MembershipRole): Promise<OrganizationMembership | null> {
    const { data, error } = await this.db.from("organization_memberships").update({ role }).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    return data ? membership(data) : null;
  }

  async getPermissionsForRole(_orgId: OrganizationId, role: MembershipRole): Promise<PermissionName[]> {
    return [...SYSTEM_ROLE_PERMISSIONS[role]];
  }

  async transferOwnership(orgId: OrganizationId, newOwnerId: UserId, newOwnerRole: NonOwnerRole = "admin"): Promise<OrganizationMembership[]> {
    const { data, error } = await this.db.rpc("transfer_organization_ownership", {
      p_organization_id: orgId,
      p_new_owner_id: newOwnerId,
      p_new_owner_role: newOwnerRole,
    });
    if (error) throw error;
    return (data ?? []).map(membership);
  }
}
