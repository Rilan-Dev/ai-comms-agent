/**
 * GET /api/organizations/[id]
 *
 * Demonstrates the server-side authorization API.
 * Per Phase 3 handoff §17: authenticate → resolve user → resolve org context
 * → check membership → check permission → perform operation.
 *
 * The organization ID is taken from the URL path (NOT the request body),
 * per Phase 3 handoff §13: "Do not trust request body organization IDs."
 *
 * Returns the organization details if the user is a member with
 * organization.read permission.
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
      { organizationId: orgId, permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    // Authorized — return org details
    const repo = getIdentityRepository();
    const org = await repo.getOrganizationById(orgId);
    if (!org) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
      },
      requested_by: {
        user_id: subject.user.id,
        email: subject.user.email,
        role: subject.membership?.role,
      },
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
