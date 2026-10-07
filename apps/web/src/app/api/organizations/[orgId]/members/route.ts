/**
 * GET /api/organizations/[orgId]/members
 *
 * Permission-gated organization member listing.
 */

import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityRepository, getIdentityAdapter, ensureDevSeed } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    await ensureDevSeed();
    const { orgId: rawOrgId } = await params;
    const orgId = asOrganizationId(rawOrgId);
    const subject = await authorize(
      request,
      { organizationId: orgId, permission: "organization.members.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );
    const repo = getIdentityRepository();
    const memberships = await repo.getMembershipsForOrg(orgId);
    const members = await Promise.all(memberships.map(async (m) => {
      const user = await repo.getUserById(m.userId);
      return { membership_id: m.id, user_id: m.userId, email: user?.email ?? null, name: user?.name ?? null, role: m.role, status: m.status };
    }));
    return NextResponse.json({
      organization_id: orgId,
      requested_by: { user_id: subject.user.id, role: subject.membership?.role },
      members,
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
