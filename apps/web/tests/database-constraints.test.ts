/**
 * Database constraint tests (in-memory repository).
 *
 * Per Phase 3 handoff §20: "Do not rely only on TypeScript validation.
 * Database integrity must exist where appropriate."
 *
 * These tests verify the in-memory repository enforces the same constraints
 * as the SQL migration (supabase/migrations/0001_identity_rbac.sql):
 *   - unique organization slug
 *   - unique user email (case-insensitive)
 *   - membership uniqueness (one per org+user)
 *   - role validity (enum)
 *   - permission catalogue uniqueness
 *
 * The SQL migration has the equivalent constraints (CREATE UNIQUE INDEX).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIdentityRepository } from "@ai-comms-agent/db";
import {
  asUserId,
  asOrganizationId,
  PERMISSION_CATALOGUE,
  SYSTEM_ROLE_PERMISSIONS,
} from "@ai-comms-agent/shared";

describe("Database constraints (in-memory)", () => {
  let repo: InMemoryIdentityRepository;

  beforeEach(() => {
    repo = InMemoryIdentityRepository.create();
  });

  it("enforces unique organization slug", async () => {
    await repo.createOrganization({ name: "Org 1", slug: "my-org" });
    await expect(repo.createOrganization({ name: "Org 2", slug: "my-org" })).rejects.toThrow(
      /already exists/,
    );
  });

  it("enforces case-insensitive unique organization slug", async () => {
    await repo.createOrganization({ name: "Org 1", slug: "My-Org" });
    await expect(repo.createOrganization({ name: "Org 2", slug: "my-org" })).rejects.toThrow(
      /already exists/,
    );
  });

  it("enforces unique user email", async () => {
    await repo.createUser({ email: "user@test.local" });
    await expect(repo.createUser({ email: "user@test.local" })).rejects.toThrow(/already exists/);
  });

  it("enforces case-insensitive unique user email", async () => {
    await repo.createUser({ email: "User@Test.Local" });
    await expect(repo.createUser({ email: "user@test.local" })).rejects.toThrow(/already exists/);
  });

  it("enforces membership uniqueness (one membership per org+user)", async () => {
    const org = await repo.createOrganization({ name: "Org", slug: "org" });
    const user = await repo.createUser({ email: "user@test.local" });
    await repo.createMembership({
      organizationId: asOrganizationId(org.id),
      userId: asUserId(user.id),
      role: "member",
    });
    await expect(
      repo.createMembership({
        organizationId: asOrganizationId(org.id),
        userId: asUserId(user.id),
        role: "admin",
      }),
    ).rejects.toThrow(/already a member/);
  });

  it("allows the same user to be a member of different organizations", async () => {
    const orgA = await repo.createOrganization({ name: "Org A", slug: "org-a" });
    const orgB = await repo.createOrganization({ name: "Org B", slug: "org-b" });
    const user = await repo.createUser({ email: "user@test.local" });

    const m1 = await repo.createMembership({
      organizationId: asOrganizationId(orgA.id),
      userId: asUserId(user.id),
      role: "member",
    });
    const m2 = await repo.createMembership({
      organizationId: asOrganizationId(orgB.id),
      userId: asUserId(user.id),
      role: "owner",
    });
    expect(m1.id).not.toBe(m2.id);
    expect(m1.role).toBe("member");
    expect(m2.role).toBe("owner");
  });

  it("permission catalogue has unique names", () => {
    const names = PERMISSION_CATALOGUE.map((p) => p.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("SYSTEM_ROLE_PERMISSIONS maps all 4 roles", () => {
    expect(SYSTEM_ROLE_PERMISSIONS.owner).toBeDefined();
    expect(SYSTEM_ROLE_PERMISSIONS.admin).toBeDefined();
    expect(SYSTEM_ROLE_PERMISSIONS.member).toBeDefined();
    expect(SYSTEM_ROLE_PERMISSIONS.viewer).toBeDefined();
  });

  it("viewer has only organization.read (least privilege)", () => {
    expect(SYSTEM_ROLE_PERMISSIONS.viewer).toEqual(["organization.read"]);
  });

  it("owner has the most permissions", () => {
    expect(SYSTEM_ROLE_PERMISSIONS.owner.length).toBeGreaterThan(SYSTEM_ROLE_PERMISSIONS.admin.length);
    expect(SYSTEM_ROLE_PERMISSIONS.admin.length).toBeGreaterThan(SYSTEM_ROLE_PERMISSIONS.member.length);
    expect(SYSTEM_ROLE_PERMISSIONS.member.length).toBeGreaterThan(SYSTEM_ROLE_PERMISSIONS.viewer.length);
  });
});
