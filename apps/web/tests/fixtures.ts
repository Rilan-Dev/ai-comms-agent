/**
 * Test fixtures for authorization tests.
 *
 * Creates a fresh in-memory repository with known users, organizations, and
 * memberships for each test. Tests do NOT share state.
 *
 * Organizations are created via createOrganizationWithOwner (the public
 * creation workflow) to satisfy the exactly-one-owner invariant.
 */

import { InMemoryIdentityRepository } from "@ai-comms-agent/db";
import type { IdentityRepository } from "@ai-comms-agent/db";
import { asUserId, asOrganizationId } from "@ai-comms-agent/shared";

export interface TestFixture {
  repo: IdentityRepository;
  orgA: string;
  orgB: string;
  ownerA: string;
  memberA: string;
  viewerA: string;
  userB: string; // member of orgB only (for isolation tests)
  suspendedA: string; // suspended in orgA
}

export async function createTestFixture(): Promise<TestFixture> {
  const repo = InMemoryIdentityRepository.create();

  // Users (created first — createOrganizationWithOwner requires the owner to exist)
  const ownerAUser = await repo.createUser({ email: "owner-a@test.local", name: "Owner A" });
  const memberAUser = await repo.createUser({ email: "member-a@test.local", name: "Member A" });
  const viewerAUser = await repo.createUser({ email: "viewer-a@test.local", name: "Viewer A" });
  const userBUser = await repo.createUser({ email: "user-b@test.local", name: "User B" });
  const suspendedAUser = await repo.createUser({ email: "suspended-a@test.local", name: "Suspended A" });

  // Organizations — created atomically with their initial owner
  // (createOrganizationWithOwner is the public creation workflow)
  const orgAResult = await repo.createOrganizationWithOwner({
    name: "Org A",
    slug: "org-a",
    ownerId: asUserId(ownerAUser.id),
  });
  const orgBResult = await repo.createOrganizationWithOwner({
    name: "Org B",
    slug: "org-b",
    ownerId: asUserId(userBUser.id),
  });

  // Additional memberships in Org A (member, viewer, suspended)
  await repo.createMembership({
    organizationId: asOrganizationId(orgAResult.organization.id),
    userId: asUserId(memberAUser.id),
    role: "member",
  });
  await repo.createMembership({
    organizationId: asOrganizationId(orgAResult.organization.id),
    userId: asUserId(viewerAUser.id),
    role: "viewer",
  });
  await repo.createMembership({
    organizationId: asOrganizationId(orgAResult.organization.id),
    userId: asUserId(suspendedAUser.id),
    role: "member",
    status: "suspended",
  });

  return {
    repo,
    orgA: orgAResult.organization.id,
    orgB: orgBResult.organization.id,
    ownerA: ownerAUser.id,
    memberA: memberAUser.id,
    viewerA: viewerAUser.id,
    userB: userBUser.id,
    suspendedA: suspendedAUser.id,
  };
}

/**
 * Create a Request with the dev-user-id header set (simulates dev identity adapter).
 */
export function createAuthedRequest(userId: string, url = "http://localhost/api/test"): Request {
  return new Request(url, {
    headers: { "x-dev-user-id": userId },
  });
}

/**
 * Create an unauthenticated Request (no dev-user-id header).
 */
export function createUnauthedRequest(url = "http://localhost/api/test"): Request {
  return new Request(url);
}
