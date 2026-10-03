/**
 * GET /api/organizations/[id]/members
 *
 * Demonstrates permission-gated access to organization members.
 * Requires: organization.members.read permission.
 * Per Phase 3 handoff §17: full authorization chain enforced server-side.
 */

import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityRepository, getIdentityAdapter, ensureDevSeed } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureDevSeed();

    const { id } = await params;
    const orgId = asOrganizationId(id);

    const subject = await authorize(
      request,
      { organizationId: orgId, permission: "organization.members.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    const repo = getIdentityRepository();
    const memberships = await repo.getMembershipsForOrg(orgId);

    // Enrich with user details
    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await repo.getUserById(m.userId);
        return {
          membership_id: m.id,
          user_id: m.userId,
          email: user?.email ?? null,
          name: user?.name ?? null,
          role: m.role,
          status: m.status,
        };
      }),
    );

    return NextResponse.json({
      organization_id: orgId,
      requested_by: {
        user_id: subject.user.id,
        role: subject.membership?.role,
      },
      members,
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
