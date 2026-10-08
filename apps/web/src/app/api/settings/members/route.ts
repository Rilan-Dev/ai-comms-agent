import { NextResponse } from "next/server";
import { asMembershipId, asOrganizationId, asUserId } from "@ai-comms-agent/shared";
import type { MembershipRole, MembershipStatus } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

async function organizationIdFrom(request: Request): Promise<string | null> {
  const context = await getAuthenticatedAppContext(request);
  const raw = new URL(request.url).searchParams.get("organizationId")?.trim() || context?.organizationId || null;
  return raw || null;
}

export async function GET(request: Request) {
  try {
    const rawId = await organizationIdFrom(request);
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const rawId = typeof body?.organizationId === "string" ? body.organizationId.trim() : await organizationIdFrom(request);
    const membershipId = typeof body?.membershipId === "string" ? body.membershipId.trim() : "";
    const action = typeof body?.action === "string" ? body.action : "role";
    if (!rawId || !membershipId) return NextResponse.json({ error: "validation_error", message: "organizationId and membershipId are required." }, { status: 422 });

    const repo = getIdentityRepository();
    if (action === "transfer_ownership") {
      await authorize(request, { organizationId: asOrganizationId(rawId), permission: "organization.update" }, getIdentityAdapter(), repo);
      const target = await repo.getMembershipsForOrg(asOrganizationId(rawId));
      const targetMembership = target.find((item) => item.id === asMembershipId(membershipId));
      if (!targetMembership) return NextResponse.json({ error: "not_found", message: "Membership was not found." }, { status: 404 });
      const updated = await repo.transferOwnership(asOrganizationId(rawId), asUserId(targetMembership.userId), "admin");
      return NextResponse.json({ memberships: updated });
    }

    await authorize(request, { organizationId: asOrganizationId(rawId), permission: "organization.members.manage" }, getIdentityAdapter(), repo);
    if (action === "status") {
      const status = body?.status as MembershipStatus;
      if (!["active", "suspended", "invited"].includes(status)) return NextResponse.json({ error: "validation_error", message: "Invalid membership status." }, { status: 422 });
      const membership = await repo.getMembershipsForOrg(asOrganizationId(rawId));
      const target = membership.find((item) => item.id === asMembershipId(membershipId));
      if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (target.role === "owner" && status !== "active") return NextResponse.json({ error: "owner_invariant", message: "Transfer ownership before suspending the current owner." }, { status: 409 });
      const updated = await repo.updateMembershipStatus(asMembershipId(membershipId), status);
      return NextResponse.json({ membership: updated });
    }

    const role = body?.role as MembershipRole;
    if (!["owner", "admin", "member", "viewer"].includes(role)) return NextResponse.json({ error: "validation_error", message: "Invalid membership role." }, { status: 422 });
    if (role === "owner") return NextResponse.json({ error: "owner_invariant", message: "Use transfer_ownership to change the organization owner." }, { status: 409 });
    const updated = await repo.updateMembershipRole(asMembershipId(membershipId), role);
    return NextResponse.json({ membership: updated });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
