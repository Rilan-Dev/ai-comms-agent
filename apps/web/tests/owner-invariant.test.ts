/**
 * Owner invariant tests.
 *
 * Per Phase 3 correction Finding B and DOMAIN_MODEL.md §2.1:
 * "An organization must have exactly one owner at all times."
 *
 * Tests:
 * - organization starts with exactly one owner
 * - cannot add a second active owner
 * - cannot demote the final active owner
 * - cannot suspend/revoke the final active owner
 * - valid ownership transfer preserves exactly one owner
 * - invalid owner transition is rejected
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIdentityRepository, OwnerInvariantError } from "@ai-comms-agent/db";
import { asUserId, asOrganizationId, asMembershipId } from "@ai-comms-agent/shared";
import { createTestFixture } from "./fixtures";

describe("Owner invariant (exactly one owner at all times)", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;

  beforeEach(async () => {
    fixture = await createTestFixture();
  });

  // -------------------------------------------------------------------
  // Creation: exactly one initial owner
  // -------------------------------------------------------------------

  it("organization starts with exactly one active owner", async () => {
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const owners = memberships.filter((m) => m.role === "owner" && m.status === "active");
    expect(owners.length).toBe(1);
    expect(owners[0]!.userId).toBe(fixture.ownerA);
  });

  // -------------------------------------------------------------------
  // Cannot add a second active owner
  // -------------------------------------------------------------------

  it("rejects adding a second active owner to an organization", async () => {
    // Use a user who is NOT already a member of orgA (userB is only in orgB)
    await expect(
      fixture.repo.createMembership({
        organizationId: asOrganizationId(fixture.orgA),
        userId: asUserId(fixture.userB),
        role: "owner",
      }),
    ).rejects.toThrow(OwnerInvariantError);
  });

  it("rejects promoting a second member to owner when an active owner exists", async () => {
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const memberMembership = memberships.find((m) => m.userId === fixture.memberA);
    await expect(
      fixture.repo.updateMembershipRole(asMembershipId(memberMembership!.id), "owner"),
    ).rejects.toThrow(OwnerInvariantError);
  });

  // -------------------------------------------------------------------
  // Cannot demote the final active owner
  // -------------------------------------------------------------------

  it("rejects demoting the final active owner to admin", async () => {
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const ownerMembership = memberships.find((m) => m.userId === fixture.ownerA);
    await expect(
      fixture.repo.updateMembershipRole(asMembershipId(ownerMembership!.id), "admin"),
    ).rejects.toThrow(OwnerInvariantError);
  });

  it("rejects demoting the final active owner to member", async () => {
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const ownerMembership = memberships.find((m) => m.userId === fixture.ownerA);
    await expect(
      fixture.repo.updateMembershipRole(asMembershipId(ownerMembership!.id), "member"),
    ).rejects.toThrow(OwnerInvariantError);
  });

  it("rejects demoting the final active owner to viewer", async () => {
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const ownerMembership = memberships.find((m) => m.userId === fixture.ownerA);
    await expect(
      fixture.repo.updateMembershipRole(asMembershipId(ownerMembership!.id), "viewer"),
    ).rejects.toThrow(OwnerInvariantError);
  });

  // -------------------------------------------------------------------
  // Cannot suspend/revoke the final active owner
  // -------------------------------------------------------------------

  it("rejects suspending the final active owner", async () => {
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const ownerMembership = memberships.find((m) => m.userId === fixture.ownerA);
    await expect(
      fixture.repo.updateMembershipStatus(asMembershipId(ownerMembership!.id), "suspended"),
    ).rejects.toThrow(OwnerInvariantError);
  });

  // -------------------------------------------------------------------
  // Valid ownership transfer preserves exactly one owner
  // -------------------------------------------------------------------

  it("valid ownership transfer preserves exactly one active owner", async () => {
    // Transfer ownership from ownerA to memberA, demoting ownerA to admin
    const result = await fixture.repo.transferOwnership(
      asOrganizationId(fixture.orgA),
      asUserId(fixture.memberA),
      "admin",
    );

    // Two memberships affected: old owner (now admin) and new owner
    expect(result.length).toBe(2);
    const oldOwner = result.find((m) => m.userId === fixture.ownerA);
    const newOwner = result.find((m) => m.userId === fixture.memberA);
    expect(oldOwner?.role).toBe("admin");
    expect(newOwner?.role).toBe("owner");

    // Verify exactly one active owner remains
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const owners = memberships.filter((m) => m.role === "owner" && m.status === "active");
    expect(owners.length).toBe(1);
    expect(owners[0]!.userId).toBe(fixture.memberA);
  });

  it("after transfer, the old owner can be demoted further (no longer the final owner)", async () => {
    // Transfer ownership from ownerA to memberA
    await fixture.repo.transferOwnership(
      asOrganizationId(fixture.orgA),
      asUserId(fixture.memberA),
    );

    // Now ownerA is admin (not owner) — can be demoted to viewer
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const oldOwnerMembership = memberships.find((m) => m.userId === fixture.ownerA);
    await expect(
      fixture.repo.updateMembershipRole(asMembershipId(oldOwnerMembership!.id), "viewer"),
    ).resolves.not.toThrow();
  });

  // -------------------------------------------------------------------
  // Invalid ownership transfer is rejected
  // -------------------------------------------------------------------

  it("rejects ownership transfer to a non-member", async () => {
    const nonMemberId = asUserId("00000000-0000-0000-0000-000000000000");
    await expect(
      fixture.repo.transferOwnership(asOrganizationId(fixture.orgA), nonMemberId),
    ).rejects.toThrow(OwnerInvariantError);
  });

  it("rejects ownership transfer to a suspended member", async () => {
    await expect(
      fixture.repo.transferOwnership(asOrganizationId(fixture.orgA), asUserId(fixture.suspendedA)),
    ).rejects.toThrow(OwnerInvariantError);
  });

  it("ownership transfer to the existing owner is a no-op", async () => {
    const result = await fixture.repo.transferOwnership(
      asOrganizationId(fixture.orgA),
      asUserId(fixture.ownerA),
    );
    expect(result.length).toBe(1);
    expect(result[0]!.role).toBe("owner");

    // Still exactly one owner
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const owners = memberships.filter((m) => m.role === "owner" && m.status === "active");
    expect(owners.length).toBe(1);
  });

  // -------------------------------------------------------------------
  // OwnerInvariantError has correct violation type
  // -------------------------------------------------------------------

  it("OwnerInvariantError for second owner has violation='multiple_owners'", async () => {
    try {
      // Use userB (not a member of orgA) to avoid the "already a member" error
      await fixture.repo.createMembership({
        organizationId: asOrganizationId(fixture.orgA),
        userId: asUserId(fixture.userB),
        role: "owner",
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(OwnerInvariantError);
      expect((error as OwnerInvariantError).violation).toBe("multiple_owners");
    }
  });

  it("OwnerInvariantError for final owner demotion has violation='no_owner'", async () => {
    const memberships = await fixture.repo.getMembershipsForOrg(asOrganizationId(fixture.orgA));
    const ownerMembership = memberships.find((m) => m.userId === fixture.ownerA);
    try {
      await fixture.repo.updateMembershipRole(asMembershipId(ownerMembership!.id), "admin");
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(OwnerInvariantError);
      expect((error as OwnerInvariantError).violation).toBe("no_owner");
    }
  });
});
