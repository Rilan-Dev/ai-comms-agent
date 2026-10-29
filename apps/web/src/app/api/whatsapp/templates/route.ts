import { NextResponse } from "next/server";
import { getWhatsAppAccountForOrganization, loadWhatsAppCredential, parseCredentialsMasterKey, query, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";
const GRAPH_HOST = "https://graph.facebook.com";

type MetaTemplate = {
  id?: unknown; name?: unknown; language?: unknown; category?: unknown; status?: unknown; components?: unknown;
};
type MetaResponse = { error?: { message?: unknown }; id?: unknown; status?: unknown; category?: unknown; data?: MetaTemplate[]; paging?: unknown };

class MetaTemplateLookupError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "MetaTemplateLookupError";
  }
}

function templateStatus(value: unknown): "pending" | "approved" | "rejected" {
  if (value === "APPROVED") return "approved";
  if (value === "REJECTED") return "rejected";
  return "pending";
}

async function getMetaContext(organizationId: string, accountId: string) {
  const account = await getWhatsAppAccountForOrganization(organizationId, accountId);
  if (!account || account.status !== "connected" || !account.business_account_id) return { error: "A connected WhatsApp account with a business account ID is required." as const };
  const masterKeyValue = process.env.CREDENTIALS_MASTER_KEY?.trim();
  if (!masterKeyValue) return { error: "WhatsApp credential decryption is not configured." as const };
  const masterKey = parseCredentialsMasterKey(masterKeyValue);
  const credential = await loadWhatsAppCredential(account.id, organizationId, masterKey);
  const token = typeof credential?.access_token === "string" ? credential.access_token : "";
  if (!token) return { error: "WhatsApp access token is unavailable." as const };
  const version = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
  const endpoint = new URL(version + "/" + encodeURIComponent(account.business_account_id) + "/message_templates", GRAPH_HOST + "/");
  return { account, token, endpoint };
}

async function syncMetaTemplates(organizationId: string, accountId: string, token: string, endpoint: URL) {
  const url = new URL(endpoint.toString());
  url.searchParams.set("fields", "id,name,language,category,status,components");
  url.searchParams.set("limit", "100");
  const response = await fetch(url, { headers: { authorization: "Bearer " + token }, cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as MetaResponse;
  if (!response.ok) throw new MetaTemplateLookupError(response.status, typeof payload.error?.message === "string" ? payload.error.message : "Meta template status lookup failed");
  for (const item of Array.isArray(payload.data) ? payload.data : []) {
    if (typeof item.id !== "string" || typeof item.name !== "string" || typeof item.language !== "string") continue;
    const category = item.category === "MARKETING" || item.category === "AUTHENTICATION" ? item.category : "UTILITY";
    await query(
      `INSERT INTO whatsapp_templates
        (organization_id, whatsapp_account_id, provider_template_id, name, language, category, status, components, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now())
       ON CONFLICT (whatsapp_account_id,name,language) DO UPDATE SET
         provider_template_id=EXCLUDED.provider_template_id, category=EXCLUDED.category,
         status=EXCLUDED.status, components=EXCLUDED.components, last_synced_at=now(), updated_at=now()`,
      [organizationId, accountId, item.id, item.name, item.language, category, templateStatus(item.status), JSON.stringify(Array.isArray(item.components) ? item.components : [])],
    );
  }
}

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const accountId = url.searchParams.get("accountId") ?? "";
    if (!organizationId || !accountId) return NextResponse.json({ error: "validation_error", message: "organizationId and accountId are required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "whatsapp.read" }, getIdentityAdapter(), getIdentityRepository());
    const context = await getMetaContext(organizationId, accountId);
    if ("error" in context) return NextResponse.json({ error: "whatsapp_not_ready", message: context.error }, { status: 409 });
    await syncMetaTemplates(organizationId, accountId, context.token, context.endpoint);
    const result = await query<{ id: string; name: string; language: string; category: string; status: string; components: unknown; last_synced_at: string | null }>(
      "SELECT id,name,language,category,status,components,last_synced_at FROM whatsapp_templates WHERE organization_id=$1 AND whatsapp_account_id=$2 ORDER BY name,language",
      [organizationId, accountId],
    );
    return NextResponse.json({ templates: result.rows });
  } catch (error) {
    if (error instanceof MetaTemplateLookupError) {
      return NextResponse.json({ error: "meta_template_lookup_failed", message: error.message }, { status: 502 });
    }
    return authorizationErrorToResponse(error);
  }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const accountId = typeof body?.accountId === "string" ? body.accountId : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const language = typeof body?.language === "string" ? body.language.trim() : "";
    const category = body?.category;
    const components = body?.components;
    if (!organizationId || !accountId || !/^[a-z0-9_]{1,512}$/.test(name) || !/^[a-zA-Z0-9_-]{2,32}$/.test(language)
      || !["UTILITY","MARKETING"].includes(category)
      || !Array.isArray(components) || components.length < 1 || components.length > 10
      || components.some((item: unknown) => !item || typeof item !== "object" || !["HEADER","BODY","FOOTER","BUTTONS"].includes(String((item as Record<string, unknown>).type)))) {
      return NextResponse.json({ error: "validation_error", message: "Valid account, template name, language, category and 1–10 Meta template components are required." }, { status: 422 });
    }
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "whatsapp.send" }, getIdentityAdapter(), getIdentityRepository());
    const context = await getMetaContext(organizationId, accountId);
    if ("error" in context) return NextResponse.json({ error: "whatsapp_not_ready", message: context.error }, { status: 409 });
    const response = await fetch(context.endpoint, {
      method: "POST",
      headers: { authorization: "Bearer " + context.token, "content-type": "application/json" },
      body: JSON.stringify({ name, language, category, components }),
    });
    const payload = await response.json().catch(() => ({})) as MetaResponse;
    if (!response.ok || typeof payload.id !== "string") {
      return NextResponse.json({ error: "meta_template_submission_failed", message: typeof payload.error?.message === "string" ? payload.error.message : "Meta did not accept the template submission." }, { status: 502 });
    }
    const result = await query<{ id: string; status: string }>(
      `INSERT INTO whatsapp_templates
        (organization_id, whatsapp_account_id, provider_template_id, name, language, category, status, components, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now())
       ON CONFLICT (whatsapp_account_id,name,language) DO UPDATE SET
         provider_template_id=EXCLUDED.provider_template_id, category=EXCLUDED.category,
         status=EXCLUDED.status, components=EXCLUDED.components, last_synced_at=now(), updated_at=now()
       RETURNING id,status`,
      [organizationId, accountId, payload.id, name, language, category, templateStatus(payload.status), JSON.stringify(components)],
    );
    await recordAuditEvent({ organizationId, actorUserId: actor.user.id, eventType: "whatsapp.template.submitted", targetType: "whatsapp_template", targetId: result.rows[0]?.id, action: "submit", decision: "allowed", metadata: { name, language, category, status: result.rows[0]?.status ?? "pending" } });
    return NextResponse.json({ submitted: true, template: result.rows[0] ?? null, message: "Template submission accepted by Meta; sending remains disabled until Meta reports it approved." }, { status: 202 });
  } catch (error) { return authorizationErrorToResponse(error); }
}
