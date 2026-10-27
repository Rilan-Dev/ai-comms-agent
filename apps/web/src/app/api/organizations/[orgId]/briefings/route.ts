import { NextResponse } from "next/server";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { listBriefings, prepareBriefing, MailboxReadStatePendingError } from "@ai-comms-agent/db";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { briefingsEnabled } from "@/lib/briefings/config";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ orgId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function trustedPrincipal(request: Request, context: Context, agentId: string) {
  const { orgId } = await context.params;
  if (!uuid.test(orgId) || !uuid.test(agentId)) return null;
  const subject = await authorize(request, {
    organizationId: asOrganizationId(orgId), permission: "email.read",
  }, getIdentityAdapter(), getIdentityRepository());
  return { organizationId: orgId, agentId, userId: subject.user.id };
}

export async function GET(request: Request, context: Context) {
  if (!briefingsEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    await ensureDevSeed();
    const params = new URL(request.url).searchParams;
    const principal = await trustedPrincipal(request, context, params.get("agentId") ?? "");
    if (!principal) return NextResponse.json({ error: "validation_error" }, { status: 400 });
    const result = await listBriefings(principal, { limit: 20 });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function POST(request: Request, context: Context) {
  if (!briefingsEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).some(key => !["agentId","mailboxIds","language","requestKey","period","mode"].includes(key))
      || body.mode !== "catch_up" || typeof body.agentId !== "string"
      || !Array.isArray(body.mailboxIds) || body.mailboxIds.length < 1 || body.mailboxIds.length > 100
      || body.mailboxIds.some((id: unknown) => typeof id !== "string" || !uuid.test(id))
      || typeof body.requestKey !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(body.requestKey)
      || typeof body.language !== "string"
      || !(body.period == null || (typeof body.period === "object" && !Array.isArray(body.period)
        && Object.keys(body.period).every(key => ["start","end"].includes(key))
        && typeof body.period.start === "string" && typeof body.period.end === "string"))) {
      return NextResponse.json({ error: "validation_error" }, { status: 422 });
    }
    const principal = await trustedPrincipal(request, context, body.agentId);
    if (!principal) return NextResponse.json({ error: "validation_error" }, { status: 400 });
    const manifest = await prepareBriefing(principal, {
      mode: "catch_up", mailboxIds: body.mailboxIds, language: body.language,
      requestKey: body.requestKey, period: body.period ?? null,
    });
    // C2 selects sources; C3 source-grounded model generation is a separate
    // worker step. Never imply a pending/partial manifest is a ready summary.
    return NextResponse.json({ manifest }, {
      status: manifest.status === "ready" ? 200 : 202,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof MailboxReadStatePendingError) return NextResponse.json({error:'mailbox_read_status_pending',message:error.message},{status:409,headers:{'Cache-Control':'private, no-store','Retry-After':'10'}});
    return authorizationErrorToResponse(error);
  }
}
