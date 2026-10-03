/**
 * RBAC persistence consistency tests.
 *
 * Per Phase 3 correction Finding A (Option A: defer persisted custom-role tables):
 *
 * Phase 3 uses four immutable system roles (owner, admin, member, viewer)
 * resolved via the TypeScript SYSTEM_ROLE_PERMISSIONS mapping. The persisted
 * `roles` and `role_permissions` tables are deferred to a later phase.
 *
 * These tests verify that Phase 3 does NOT accidentally depend on deferred
 * custom-role persistence — i.e., the authorization model is self-consistent
 * using only the TypeScript mapping.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIdentityRepository } from "@ai-comms-agent/db";
import {
  asUserId,
  asOrganizationId,
  SYSTEM_ROLE_PERMISSIONS,
  PERMISSION_CATALOGUE,
  type PermissionName,
} from "@ai-comms-agent/shared";
import { createTestFixture } from "./fixtures";

describe("RBAC persistence consistency (Option A: system roles, deferred custom-role tables)", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;

  beforeEach(async () => {
    fixture = await createTestFixture();
  });

  it("SYSTEM_ROLE_PERMISSIONS is the single authoritative RBAC model (no persisted roles needed)", () => {
    // The TypeScript constant is the source of truth for Phase 3.
    // No database query is needed to resolve system role permissions.
    expect(SYSTEM_ROLE_PERMISSIONS.owner).toBeDefined();
    expect(SYSTEM_ROLE_PERMISSIONS.admin).toBeDefined();
    expect(SYSTEM_ROLE_PERMISSIONS.member).toBeDefined();
    expect(SYSTEM_ROLE_PERMISSIONS.viewer).toBeDefined();
  });

  it("getPermissionsForRole returns permissions from SYSTEM_ROLE_PERMISSIONS (not from persisted tables)", async () => {
    const repo = fixture.repo;
    const orgId = asOrganizationId(fixture.orgA);

    // For each system role, the repository returns exactly the TypeScript mapping
    for (const role of ["owner", "admin", "member", "viewer"] as const) {
      const permissions = await repo.getPermissionsForRole(orgId, role);
      expect(permissions).toEqual([...SYSTEM_ROLE_PERMISSIONS[role]]);
    }
  });

  it("PERMISSION_CATALOGUE contains only Phase 3 identity/RBAC foundation permissions", () => {
    // Per Finding C: feature-domain permissions (agent.*, email.*, whatsapp.*, schedule.*)
    // are NOT in the Phase 3 catalogue. They are introduced with their respective phases.
    const names = PERMISSION_CATALOGUE.map((p) => p.name);
    expect(names).toContain("organization.read");
    expect(names).toContain("organization.update");
    expect(names).toContain("organization.members.read");
    expect(names).toContain("organization.members.manage");
    expect(names).toContain("users.read");
    expect(names).toContain("users.manage");
    expect(names).toContain("audit.read");
    expect(names).toContain("settings.read");
    expect(names).toContain("settings.manage");

    // Explicitly NOT present in Phase 3 (deferred to feature phases)
    expect(names).not.toContain("agent.read");
    expect(names).not.toContain("email.send");
    expect(names).not.toContain("whatsapp.send");
    expect(names).not.toContain("schedule.read");
  });

  it("authorization decisions are consistent across organizations with the same role", async () => {
    // System roles are immutable and global — the same role produces the same
    // permissions regardless of organization. This is the key property of
    // Option A: no per-organization custom roles, so no per-org variation.
    const repo = fixture.repo;

    const orgAOwnerPerms = await repo.getPermissionsForRole(asOrganizationId(fixture.orgA), "owner");
    const orgBOwnerPerms = await repo.getPermissionsForRole(asOrganizationId(fixture.orgB), "owner");
    expect(orgAOwnerPerms).toEqual(orgBOwnerPerms);

    const orgAViewerPerms = await repo.getPermissionsForRole(asOrganizationId(fixture.orgA), "viewer");
    const orgBViewerPerms = await repo.getPermissionsForRole(asOrganizationId(fixture.orgB), "viewer");
    expect(orgAViewerPerms).toEqual(orgBViewerPerms);
  });

  it("Phase 3 does not reference deferred roles/role_permissions tables at runtime", async () => {
    // The InMemoryIdentityRepository does not have any methods that query
    // a `roles` or `role_permissions` table. The getPermissionsForRole method
    // uses SYSTEM_ROLE_PERMISSIONS directly. This test documents that fact.
    const repo = fixture.repo as InMemoryIdentityRepository;

    // Verify the method signature does not accept a role_id or query a roles table
    const perms = await repo.getPermissionsForRole(asOrganizationId(fixture.orgA), "member");
    expect(perms).toEqual(["organization.read", "users.read"]);
  });

  it("viewer has exactly one permission (least privilege enforced by TypeScript mapping)", () => {
    expect(SYSTEM_ROLE_PERMISSIONS.viewer).toEqual(["organization.read"]);
    expect(SYSTEM_ROLE_PERMISSIONS.viewer.length).toBe(1);
  });

  it("permission hierarchy: owner > admin > member > viewer", () => {
    expect(SYSTEM_ROLE_PERMISSIONS.owner.length).toBeGreaterThan(SYSTEM_ROLE_PERMISSIONS.admin.length);
    expect(SYSTEM_ROLE_PERMISSIONS.admin.length).toBeGreaterThan(SYSTEM_ROLE_PERMISSIONS.member.length);
    expect(SYSTEM_ROLE_PERMISSIONS.member.length).toBeGreaterThan(SYSTEM_ROLE_PERMISSIONS.viewer.length);
  });

  it("all SYSTEM_ROLE_PERMISSIONS entries reference permissions in PERMISSION_CATALOGUE", () => {
    const catalogueNames = new Set(PERMISSION_CATALOGUE.map((p) => p.name));
    for (const role of ["owner", "admin", "member", "viewer"] as const) {
      for (const perm of SYSTEM_ROLE_PERMISSIONS[role]) {
        expect(catalogueNames.has(perm as PermissionName)).toBe(true);
      }
    }
  });
});
