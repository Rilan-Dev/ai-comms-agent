/**
 * Organization isolation and membership tests.
 *
 * Per Phase 3 handoff §19:
 * - valid member can access organization
 * - non-member rejected
 * - organization context cannot be spoofed
 * - User A → Organization A → allowed
 * - User A → Organization B → denied
 * - client-provided organization IDs do not bypass membership
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ForbiddenError, UnauthorizedError, asOrganizationId } from "@ai-comms-agent/shared";
import { DevIdentityAdapter } from "@/lib/identity/dev-adapter";
import { requireOrganizationMember } from "@/lib/identity/authorization";
import { createTestFixture, createAuthedRequest, createUnauthedRequest } from "./fixtures";

describe("Organization isolation", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;
  let adapter: DevIdentityAdapter;

  beforeEach(async () => {
    fixture = await createTestFixture();
    adapter = new DevIdentityAdapter(fixture.repo);
  });

  it("allows valid member to access their organization", async () => {
    const request = createAuthedRequest(fixture.ownerA);
    const subject = await requireOrganizationMember(
      request,
      asOrganizationId(fixture.orgA),
      adapter,
      fixture.repo,
    );
    expect(subject.user.id).toBe(fixture.ownerA);
    expect(subject.membership?.organizationId).toBe(fixture.orgA);
    expect(subject.membership?.role).toBe("owner");
  });

  it("denies non-member access to organization (IDOR protection)", async () => {
    // userB is a member of orgB, NOT orgA
    const request = createAuthedRequest(fixture.userB);
    await expect(
      requireOrganizationMember(request, asOrganizationId(fixture.orgA), adapter, fixture.repo),
    ).rejects.toThrow(ForbiddenError);
  });

  it("denies User A access to Organization B (cross-organization denial)", async () => {
    // ownerA is a member of orgA, NOT orgB
    const request = createAuthedRequest(fixture.ownerA);
    await expect(
      requireOrganizationMember(request, asOrganizationId(fixture.orgB), adapter, fixture.repo),
    ).rejects.toThrow(ForbiddenError);
  });

  it("denies unauthenticated request to organization endpoint", async () => {
    const request = createUnauthedRequest();
    await expect(
      requireOrganizationMember(request, asOrganizationId(fixture.orgA), adapter, fixture.repo),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("denies suspended membership access", async () => {
    const request = createAuthedRequest(fixture.suspendedA);
    await expect(
      requireOrganizationMember(request, asOrganizationId(fixture.orgA), adapter, fixture.repo),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects unknown organization ID (no membership found)", async () => {
    const request = createAuthedRequest(fixture.ownerA);
    const unknownOrgId = asOrganizationId("00000000-0000-0000-0000-000000000000");
    await expect(
      requireOrganizationMember(request, unknownOrgId, adapter, fixture.repo),
    ).rejects.toThrow(ForbiddenError);
  });

  it("does not trust client-provided organization ID from request body", async () => {
    // The authorization API takes organizationId from the URL path parameter,
    // NOT from the request body. This test verifies that even if a malicious
    // client puts an orgId in the body, it's ignored.
    const request = new Request("http://localhost/api/organizations/" + fixture.orgA, {
      headers: { "x-dev-user-id": fixture.userB, "content-type": "application/json" },
      body: JSON.stringify({ organizationId: fixture.orgA }), // spoofed in body
      method: "POST",
    });
    // userB is NOT a member of orgA — must be denied regardless of body
    await expect(
      requireOrganizationMember(request, asOrganizationId(fixture.orgA), adapter, fixture.repo),
    ).rejects.toThrow(ForbiddenError);
  });
});
