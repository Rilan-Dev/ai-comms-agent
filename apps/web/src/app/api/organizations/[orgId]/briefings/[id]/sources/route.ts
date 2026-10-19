import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { listBriefingSources } from "@ai-comms-agent/db";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { briefingsEnabled } from "@/lib/briefings/config";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ orgId: string; id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: Context) {
  if (!briefingsEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    await ensureDevSeed();
    const { orgId, id } = await context.params;
    const params = new URL(request.url).searchParams;
    const agentId = params.get("agentId") ?? "";
    const cursor = params.get("cursor");
    const limit = Number(params.get("limit") ?? "200");
    if (![orgId,id,agentId].every(value => uuid.test(value)) || (cursor && !uuid.test(cursor))
      || !Number.isInteger(limit) || limit < 1 || limit > 200) {
      return NextResponse.json({ error: "validation_error" }, { status: 422 });
    }
    const subject = await authorize(request, {
      organizationId: asOrganizationId(orgId), permission: "email.read",
    }, getIdentityAdapter(), getIdentityRepository());
    const result = await listBriefingSources({
      organizationId: orgId, userId: subject.user.id, agentId,
    }, id, cursor, limit);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authorizationErrorToResponse(error); }
}
