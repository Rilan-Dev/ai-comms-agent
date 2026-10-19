import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { getBriefing } from "@ai-comms-agent/db";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { briefingsEnabled } from "@/lib/briefings/config";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ orgId: string; id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: Context) {
  if (!briefingsEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    await ensureDevSeed();
    const { orgId, id } = await context.params;
    const agentId = new URL(request.url).searchParams.get("agentId") ?? "";
    if (![orgId,id,agentId].every(value => uuid.test(value))) {
      return NextResponse.json({ error: "validation_error" }, { status: 422 });
    }
    const subject = await authorize(request, {
      organizationId: asOrganizationId(orgId), permission: "email.read",
    }, getIdentityAdapter(), getIdentityRepository());
    const briefing = await getBriefing({ organizationId: orgId, userId: subject.user.id, agentId }, id);
    return NextResponse.json(briefing, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authorizationErrorToResponse(error); }
}
