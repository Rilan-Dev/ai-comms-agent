import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const context = await getAuthenticatedAppContext(request);
    const rawId = url.searchParams.get("organizationId")?.trim() || context?.organizationId || "";
    if (!rawId) return NextResponse.json({ error: "configuration_required", message: "An organization context is required." }, { status: 422 });

    const subject = await authorize(request, { organizationId: asOrganizationId(rawId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const organization = await getIdentityRepository().getOrganizationById(asOrganizationId(rawId));
    if (!organization) return NextResponse.json({ error: "not_found", message: "Organization was not found." }, { status: 404 });

    const membership = await getIdentityRepository().getMembership(asOrganizationId(rawId), subject.user.id);
    return NextResponse.json({ organization, membership });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
