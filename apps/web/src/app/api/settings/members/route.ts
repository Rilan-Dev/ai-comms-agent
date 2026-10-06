import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getDevOrgId, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureDevSeed();
    const url = new URL(request.url);
    const rawId = url.searchParams.get("organizationId")?.trim() || getDevOrgId();
    if (!rawId) return NextResponse.json({ error: "configuration_required", message: "An organization context is required." }, { status: 422 });

    await authorize(request, { organizationId: asOrganizationId(rawId), permission: "organization.members.read" }, getIdentityAdapter(), getIdentityRepository());
    const memberships = await getIdentityRepository().getMembershipsForOrg(asOrganizationId(rawId));
    const members = await Promise.all(memberships.map(async (membership) => {
      const user = await getIdentityRepository().getUserById(membership.userId);
      return { ...membership, user: user ? { id: user.id, email: user.email, name: user.name, status: user.status } : null };
    }));
    return NextResponse.json({ members });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
