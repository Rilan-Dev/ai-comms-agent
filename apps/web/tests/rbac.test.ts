/**
 * RBAC and permission enforcement tests.
 *
 * Per Phase 3 handoff §19:
 * - OWNER permissions
 * - ADMIN permissions
 * - MEMBER permissions
 * - VIEWER permissions
 * - permitted operation succeeds
 * - missing permission rejected
 * - role changes affect authorization
 * - suspended/revoked memberships are rejected
 * - unknown permissions fail safely
 * - unknown roles fail safely
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ForbiddenError,
  asOrganizationId,
  asMembershipId,
  asUserId,
  type PermissionName,
} from "@ai-comms-agent/shared";
import { DevIdentityAdapter } from "@/lib/identity/dev-adapter";
import {
  requireOrganizationMember,
  requirePermission,
  requireRole,
  authorize,
} from "@/lib/identity/authorization";
import { createTestFixture, createAuthedRequest } from "./fixtures";

describe("RBAC and permissions", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;
  let adapter: DevIdentityAdapter;

  beforeEach(async () => {
    fixture = await createTestFixture();
    adapter = new DevIdentityAdapter(fixture.repo);
  });

  // -------------------------------------------------------------------
  // Role-based permission tests
  // -------------------------------------------------------------------

  it("OWNER has all permissions (organization.read, members.read, members.manage, settings.manage, audit.read)", async () => {
    const request = createAuthedRequest(fixture.ownerA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(subject.permissions.has("organization.read")).toBe(true);
    expect(subject.permissions.has("organization.members.read")).toBe(true);
    expect(subject.permissions.has("organization.members.manage")).toBe(true);
    expect(subject.permissions.has("settings.manage")).toBe(true);
    expect(subject.permissions.has("audit.read")).toBe(true);
    expect(subject.permissions.has("users.read")).toBe(true);
    expect(subject.permissions.has("users.manage")).toBe(true);
    expect(subject.permissions.has("email.read")).toBe(true);
    expect(subject.permissions.has("whatsapp.read")).toBe(true);
    expect(subject.permissions.has("whatsapp.send")).toBe(true);
  });

  it("ADMIN has read + settings.manage but NOT members.manage or organization.update", async () => {
    // Promote memberA to admin
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const memberMembership = memberships.find((m) => m.userId === fixture.memberA);
    await fixture.repo.updateMembershipRole(asMembershipId(memberMembership!.id), "admin");

    const request = createAuthedRequest(fixture.memberA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(subject.membership?.role).toBe("admin");
    expect(subject.permissions.has("organization.read")).toBe(true);
    expect(subject.permissions.has("organization.members.read")).toBe(true);
    expect(subject.permissions.has("settings.manage")).toBe(true);
    expect(subject.permissions.has("audit.read")).toBe(true);
    expect(subject.permissions.has("organization.members.manage")).toBe(false);
    expect(subject.permissions.has("organization.update")).toBe(false);
    expect(subject.permissions.has("whatsapp.read")).toBe(true);
    expect(subject.permissions.has("whatsapp.send")).toBe(true);
  });

  it("MEMBER has organization.read and users.read but NOT members.read or settings.manage", async () => {
    const request = createAuthedRequest(fixture.memberA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(subject.membership?.role).toBe("member");
    expect(subject.permissions.has("organization.read")).toBe(true);
    expect(subject.permissions.has("users.read")).toBe(true);
    expect(subject.permissions.has("organization.members.read")).toBe(false);
    expect(subject.permissions.has("settings.manage")).toBe(false);
    expect(subject.permissions.has("audit.read")).toBe(false);
    expect(subject.permissions.has("whatsapp.read")).toBe(true);
    expect(subject.permissions.has("whatsapp.send")).toBe(false);
  });

  it("VIEWER has only organization.read (least privilege)", async () => {
    const request = createAuthedRequest(fixture.viewerA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(subject.membership?.role).toBe("viewer");
    expect(subject.permissions.has("organization.read")).toBe(true);
    expect(subject.permissions.size).toBe(1); // ONLY organization.read
    expect(subject.permissions.has("email.read")).toBe(false);
    expect(subject.permissions.has("whatsapp.read")).toBe(false);
    expect(subject.permissions.has("whatsapp.send")).toBe(false);
    expect(subject.permissions.has("users.read")).toBe(false);
    expect(subject.permissions.has("organization.members.read")).toBe(false);
    expect(subject.permissions.has("audit.read")).toBe(false);
  });

  // -------------------------------------------------------------------
  // Permission enforcement
  // -------------------------------------------------------------------

  it("permits operation when user has the required permission", async () => {
    const request = createAuthedRequest(fixture.ownerA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(() => requirePermission(subject, "organization.members.manage")).not.toThrow();
  });

  it("rejects operation when user lacks the required permission", async () => {
    const request = createAuthedRequest(fixture.viewerA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(() => requirePermission(subject, "organization.members.manage" as PermissionName)).toThrow(
      ForbiddenError,
    );
  });

  it("rejects VIEWER attempting to read members (least privilege enforced)", async () => {
    const request = createAuthedRequest(fixture.viewerA);
    await expect(
      authorize(
        request,
        { organizationId: asOrganizationId(fixture.orgA), permission: "organization.members.read" },
        adapter,
        fixture.repo,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("allows OWNER to read members", async () => {
    const request = createAuthedRequest(fixture.ownerA);
    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(fixture.orgA), permission: "organization.members.read" },
      adapter,
      fixture.repo,
    );
    expect(subject.user.id).toBe(fixture.ownerA);
  });

  // -------------------------------------------------------------------
  // Role changes affect authorization
  // -------------------------------------------------------------------

  it("role change from MEMBER to ADMIN grants additional permissions", async () => {
    // Initially memberA is a member — cannot read members
    const request1 = createAuthedRequest(fixture.memberA);
    await expect(
      authorize(
        request1,
        { organizationId: asOrganizationId(fixture.orgA), permission: "organization.members.read" },
        adapter,
        fixture.repo,
      ),
    ).rejects.toThrow(ForbiddenError);

    // Promote to admin
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const memberMembership = memberships.find((m) => m.userId === fixture.memberA);
    await fixture.repo.updateMembershipRole(asMembershipId(memberMembership!.id), "admin");

    // Now can read members
    const request2 = createAuthedRequest(fixture.memberA);
    const subject = await authorize(
      request2,
      { organizationId: asOrganizationId(fixture.orgA), permission: "organization.members.read" },
      adapter,
      fixture.repo,
    );
    expect(subject.membership?.role).toBe("admin");
  });

  it("role change from OWNER to non-owner removes permissions (after ownership transfer)", async () => {
    // Initially ownerA can manage members
    const request1 = createAuthedRequest(fixture.ownerA);
    const subject1 = await authorize(
      request1,
      { organizationId: asOrganizationId(fixture.orgA), permission: "organization.members.manage" },
      adapter,
      fixture.repo,
    );
    expect(subject1.membership?.role).toBe("owner");

    // Transfer ownership from ownerA to memberA, demoting ownerA to viewer.
    // This is the only valid way to remove owner permissions — direct demotion
    // of the final owner is rejected by the owner invariant (tested separately).
    await fixture.repo.transferOwnership(
      asOrganizationId(fixture.orgA),
      asUserId(fixture.memberA),
      "viewer",
    );

    // ownerA is now a viewer — cannot manage members
    const request2 = createAuthedRequest(fixture.ownerA);
    await expect(
      authorize(
        request2,
        { organizationId: asOrganizationId(fixture.orgA), permission: "organization.members.manage" },
        adapter,
        fixture.repo,
      ),
    ).rejects.toThrow(ForbiddenError);

    // memberA is now the owner — can manage members
    const request3 = createAuthedRequest(fixture.memberA);
    const subject3 = await authorize(
      request3,
      { organizationId: asOrganizationId(fixture.orgA), permission: "organization.members.manage" },
      adapter,
      fixture.repo,
    );
    expect(subject3.membership?.role).toBe("owner");
  });

  // -------------------------------------------------------------------
  // Suspended membership
  // -------------------------------------------------------------------

  it("suspended membership is rejected even if user previously had permissions", async () => {
    const request = createAuthedRequest(fixture.suspendedA);
    await expect(
      authorize(
        request,
        { organizationId: asOrganizationId(fixture.orgA), permission: "organization.read" },
        adapter,
        fixture.repo,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  // -------------------------------------------------------------------
  // Unknown permissions / roles fail safely
  // -------------------------------------------------------------------

  it("unknown permission fails safely (denied, not error)", async () => {
    const request = createAuthedRequest(fixture.ownerA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    // Owner has all PERMISSION_CATALOGUE entries, but an unknown permission
    // string should be denied (not in the set)
    expect(() =>
      requirePermission(subject, "nonexistent.permission" as PermissionName),
    ).toThrow(ForbiddenError);
  });

  it("requireRole rejects when subject has insufficient role", async () => {
    const request = createAuthedRequest(fixture.viewerA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(() => requireRole(subject, "owner", "admin")).toThrow(ForbiddenError);
  });

  it("requireRole accepts when subject has one of the required roles", async () => {
    const request = createAuthedRequest(fixture.memberA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(() => requireRole(subject, "member", "viewer")).not.toThrow();
  });

  it("requireRole does not treat VIEWER as MEMBER", async () => {
    const request = createAuthedRequest(fixture.viewerA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(() => requireRole(subject, "member")).toThrow(ForbiddenError);
  });

  it("requireRole treats ADMIN and OWNER as at least MEMBER", async () => {
    // The fixture has memberA and ownerA, but no adminA. Promote memberA
    // through the repository so the test exercises a real authenticated admin.
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const memberMembership = memberships.find((membership) => membership.userId === fixture.memberA);
    expect(memberMembership).toBeDefined();
    await fixture.repo.updateMembershipRole(asMembershipId(memberMembership!.id), "admin");

    for (const userId of [fixture.memberA, fixture.ownerA]) {
      const request = createAuthedRequest(userId);
      const subject = await requireOrganizationMember(
        request,
        asOrganizationId(fixture.orgA),
        adapter,
        fixture.repo,
      );
      expect(() => requireRole(subject, "member")).not.toThrow();
    }
  });
});
