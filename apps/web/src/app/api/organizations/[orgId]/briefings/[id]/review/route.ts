import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { acknowledgeBriefingItems } from "@ai-comms-agent/db";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { briefingsEnabled } from "@/lib/briefings/config";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ orgId: string; id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: Context) {
  if (!briefingsEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    await ensureDevSeed();
    const { orgId, id } = await context.params;
    const body = await request.json().catch(() => null);
    if (![orgId,id].every(value => uuid.test(value))
      || !body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).some(key => !["agentId","itemIds","expectedScopeVersion"].includes(key))
      || typeof body.agentId !== "string" || !uuid.test(body.agentId)
      || !Array.isArray(body.itemIds) || body.itemIds.length < 1 || body.itemIds.length > 200
      || body.itemIds.some((item: unknown) => typeof item !== "string" || !item.trim() || item.length > 200)
      || typeof body.expectedScopeVersion !== "string" || !/^[a-f0-9]{64}$/.test(body.expectedScopeVersion)) {
      return NextResponse.json({ error: "validation_error" }, { status: 422 });
    }
    const subject = await authorize(request, {
      organizationId: asOrganizationId(orgId), permission: "email.read",
    }, getIdentityAdapter(), getIdentityRepository());
    // Opening Catch up, signing in or visiting Chat never acknowledges mail.
    // Only this explicit same-origin user action writes review progress.
    const result = await acknowledgeBriefingItems({
      organizationId: orgId, userId: subject.user.id, agentId: body.agentId,
    }, id, body.itemIds, body.expectedScopeVersion);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authorizationErrorToResponse(error); }
}
