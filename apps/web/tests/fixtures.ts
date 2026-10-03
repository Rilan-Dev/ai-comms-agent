/**
 * Test fixtures for authorization tests.
 *
 * Creates a fresh in-memory repository with known users, organizations, and
 * memberships for each test. Tests do NOT share state.
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

  // Organizations
  const orgA = await repo.createOrganization({ name: "Org A", slug: "org-a" });
  const orgB = await repo.createOrganization({ name: "Org B", slug: "org-b" });

  // Users
  const ownerAUser = await repo.createUser({ email: "owner-a@test.local", name: "Owner A" });
  const memberAUser = await repo.createUser({ email: "member-a@test.local", name: "Member A" });
  const viewerAUser = await repo.createUser({ email: "viewer-a@test.local", name: "Viewer A" });
  const userBUser = await repo.createUser({ email: "user-b@test.local", name: "User B" });
  const suspendedAUser = await repo.createUser({ email: "suspended-a@test.local", name: "Suspended A" });

  // Memberships in Org A
  await repo.createMembership({
    organizationId: asOrganizationId(orgA.id),
    userId: asUserId(ownerAUser.id),
    role: "owner",
  });
  await repo.createMembership({
    organizationId: asOrganizationId(orgA.id),
    userId: asUserId(memberAUser.id),
    role: "member",
  });
  await repo.createMembership({
    organizationId: asOrganizationId(orgA.id),
    userId: asUserId(viewerAUser.id),
    role: "viewer",
  });
  const suspendedMembership = await repo.createMembership({
    organizationId: asOrganizationId(orgA.id),
    userId: asUserId(suspendedAUser.id),
    role: "member",
    status: "suspended",
  });

  // Membership in Org B (userB only)
  await repo.createMembership({
    organizationId: asOrganizationId(orgB.id),
    userId: asUserId(userBUser.id),
    role: "owner",
  });

  return {
    repo,
    orgA: orgA.id,
    orgB: orgB.id,
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
