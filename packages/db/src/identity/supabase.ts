import { query, withTransaction } from "../client";
import type {
  IdentityRepository, OrganizationWithOwner,
} from "./repository";
import type {
  UserId, OrganizationId, MembershipId, MembershipRole, NonOwnerRole,
  MembershipStatus, User, Organization, OrganizationMembership, PermissionName,
} from "@ai-comms-agent/shared";
import {
  asUserId, asOrganizationId, asMembershipId, SYSTEM_ROLE_PERMISSIONS,
} from "@ai-comms-agent/shared";

type Row = Record<string, unknown>;

function requiredRow(row: Row | undefined, entity: string): Row {
  if (!row) throw new Error(`${entity} query returned no row`);
  return row;
}

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
    productName: (row.product_name as string | null) ?? null,
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
 * PostgreSQL implementation of the identity repository.
 *
 * The file name is retained for compatibility with the Phase 3 export surface;
 * the implementation is no longer Supabase-specific.
 */
export class PostgresIdentityRepository implements IdentityRepository {
  async getUserById(id: UserId): Promise<User | null> {
    const r = await query<Row>("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [id]);
    return r.rows[0] ? user(r.rows[0]) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const r = await query<Row>("SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL", [email]);
    return r.rows[0] ? user(r.rows[0]) : null;
  }

  async createUser(input: { email: string; name?: string | null }): Promise<User> {
    const r = await query<Row>(
      "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *",
      [input.email, input.name ?? null],
    );
    return user(requiredRow(r.rows[0], "user"));
  }

  async getOrganizationById(id: OrganizationId): Promise<Organization | null> {
    const r = await query<Row>(
      "SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return r.rows[0] ? organization(r.rows[0]) : null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const r = await query<Row>(
      "SELECT * FROM organizations WHERE slug = $1 AND deleted_at IS NULL",
      [slug],
    );
    return r.rows[0] ? organization(r.rows[0]) : null;
  }

  async updateOrganizationProfile(
    id: OrganizationId,
    input: { name?: string; productName?: string | null },
  ): Promise<Organization | null> {
    const existing = await this.getOrganizationById(id);
    if (!existing) return null;
    const nextName = input.name?.trim() || existing.name;
    const nextProductName =
      input.productName === undefined
        ? existing.productName
        : input.productName?.trim()
          ? input.productName.trim()
          : null;
    const r = await query<Row>(
      `UPDATE organizations
       SET name = $2, product_name = $3, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, nextName, nextProductName],
    );
    return r.rows[0] ? organization(r.rows[0]) : null;
  }

  async createOrganization(): Promise<Organization> {
    throw new Error("createOrganization is internal and disabled; use createOrganizationWithOwner");
  }

  async createOrganizationWithOwner(input: {
    name: string; slug: string; ownerId: UserId;
  }): Promise<OrganizationWithOwner> {
    return withTransaction(async (client) => {
      const org = await client.query<Row>(
        "INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING *",
        [input.name, input.slug],
      );
      const organizationRow = requiredRow(org.rows[0], "organization");
      const membershipRow = await client.query<Row>(
        `INSERT INTO organization_memberships (organization_id, user_id, role, status)
         VALUES ($1, $2, 'owner', 'active')
         RETURNING *`,
        [organizationRow.id, input.ownerId],
      );
      return {
        organization: organization(organizationRow),
        ownerMembership: membership(requiredRow(membershipRow.rows[0], "owner membership")),
      };
    });
  }

  async getMembership(orgId: OrganizationId, userId: UserId): Promise<OrganizationMembership | null> {
    const r = await query<Row>(
      "SELECT * FROM organization_memberships WHERE organization_id = $1 AND user_id = $2",
      [orgId, userId],
    );
    return r.rows[0] ? membership(r.rows[0]) : null;
  }

  async getMembershipsForUser(userId: UserId): Promise<OrganizationMembership[]> {
    const r = await query<Row>(
      "SELECT * FROM organization_memberships WHERE user_id = $1 ORDER BY created_at ASC",
      [userId],
    );
    return r.rows.map(membership);
  }

  async getMembershipsForOrg(orgId: OrganizationId): Promise<OrganizationMembership[]> {
    const r = await query<Row>(
      "SELECT * FROM organization_memberships WHERE organization_id = $1 ORDER BY created_at ASC",
      [orgId],
    );
    return r.rows.map(membership);
  }

  async createMembership(input: {
    organizationId: OrganizationId; userId: UserId; role: MembershipRole; status?: MembershipStatus;
  }): Promise<OrganizationMembership> {
    const r = await query<Row>(
      `INSERT INTO organization_memberships (organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.organizationId, input.userId, input.role, input.status ?? "active"],
    );
    return membership(requiredRow(r.rows[0], "membership"));
  }

  async updateMembershipStatus(id: MembershipId, status: MembershipStatus): Promise<OrganizationMembership | null> {
    const r = await query<Row>(
      "UPDATE organization_memberships SET status = $1 WHERE id = $2 RETURNING *",
      [status, id],
    );
    return r.rows[0] ? membership(r.rows[0]) : null;
  }

  async updateMembershipRole(id: MembershipId, role: MembershipRole): Promise<OrganizationMembership | null> {
    const r = await query<Row>(
      "UPDATE organization_memberships SET role = $1 WHERE id = $2 RETURNING *",
      [role, id],
    );
    return r.rows[0] ? membership(r.rows[0]) : null;
  }

  async getPermissionsForRole(_orgId: OrganizationId, role: MembershipRole): Promise<PermissionName[]> {
    return [...SYSTEM_ROLE_PERMISSIONS[role]];
  }

  async transferOwnership(
    orgId: OrganizationId,
    newOwnerId: UserId,
    newOwnerRole: NonOwnerRole = "admin",
  ): Promise<OrganizationMembership[]> {
    return withTransaction(async (client) => {
      const current = await client.query<Row>(
        "SELECT * FROM organization_memberships WHERE organization_id = $1 AND role = 'owner' AND status = 'active' FOR UPDATE",
        [orgId],
      );
      if (current.rows.length !== 1) {
        throw new Error("Owner invariant violated: expected exactly one active owner");
      }
      const currentOwner = requiredRow(current.rows[0], "current owner");

      const target = await client.query<Row>(
        "SELECT * FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE",
        [orgId, newOwnerId],
      );
      const targetMember = target.rows[0];
      if (!targetMember) throw new Error("New owner must be an active organization member");
      if (targetMember.role === "owner") return [membership(targetMember)];

      await client.query(
        "UPDATE organization_memberships SET role = $1 WHERE id = $2",
        [newOwnerRole, currentOwner.id],
      );
      await client.query(
        "UPDATE organization_memberships SET role = 'owner' WHERE id = $1",
        [targetMember.id],
      );

      const result = await client.query<Row>(
        "SELECT * FROM organization_memberships WHERE organization_id = $1 ORDER BY created_at ASC",
        [orgId],
      );
      return result.rows.map(membership);
    });
  }
}

export { PostgresIdentityRepository as SupabaseIdentityRepository };
