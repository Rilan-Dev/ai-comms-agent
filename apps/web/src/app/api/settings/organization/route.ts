import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 120;
const MAX_PRODUCT_NAME_LENGTH = 80;

function sanitizeProfileText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || null;
}

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

export async function PATCH(request: Request) {
  try {
    const context = await getAuthenticatedAppContext(request);
    const rawId = context?.organizationId || "";
    if (!rawId) return NextResponse.json({ error: "configuration_required", message: "An organization context is required." }, { status: 422 });

    await authorize(request, { organizationId: asOrganizationId(rawId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());

    const body = await request.json().catch(() => null) as {
      name?: unknown;
      productName?: unknown;
    } | null;

    const nextName = body?.name === undefined ? undefined : sanitizeProfileText(body.name, MAX_NAME_LENGTH);
    if (body?.name !== undefined && nextName === null) {
      return NextResponse.json({ error: "validation_error", message: "Organization name must be 1-120 characters." }, { status: 400 });
    }

    const nextProductName = body?.productName === undefined ? undefined : sanitizeProfileText(body.productName, MAX_PRODUCT_NAME_LENGTH);

    const organization = await getIdentityRepository().updateOrganizationProfile(
      asOrganizationId(rawId),
      { name: nextName ?? undefined, productName: nextProductName },
    );
    if (!organization) return NextResponse.json({ error: "not_found", message: "Organization was not found." }, { status: 404 });

    return NextResponse.json({ organization });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
