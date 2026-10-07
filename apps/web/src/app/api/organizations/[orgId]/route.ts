/**
 * GET /api/organizations/[orgId]
 *
 * Server-side organization authorization endpoint.
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
      { organizationId: orgId, permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );
    const repo = getIdentityRepository();
    const org = await repo.getOrganizationById(orgId);
    if (!org) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({
      organization: { id: org.id, name: org.name, slug: org.slug, status: org.status },
      requested_by: { user_id: subject.user.id, email: subject.user.email, role: subject.membership?.role },
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
