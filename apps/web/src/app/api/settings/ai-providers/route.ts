import { NextResponse } from "next/server";
import { decryptCredential, encryptCredential, parseCredentialsMasterKey, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { fetchLiveModelCatalog } from "@/lib/ai/live-model-catalog";

export const dynamic = "force-dynamic";
const allowed = ["openai", "gemini", "sarvam"];

async function orgId(request: Request, body?: Record<string, unknown>) {
  const context = await getAuthenticatedAppContext(request);
  const supplied = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
  const fromQuery = new URL(request.url).searchParams.get("organizationId")?.trim() ?? "";
  const id = supplied || fromQuery || context?.organizationId || "";
  if (!id) throw new Error("An organization context is required.");
  return id;
}

export async function GET(request: Request) {
  try {
    const organizationId = await orgId(request);
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const result = await query<{ provider: string; model: string | null; enabled: boolean; encrypted_api_key: Buffer | null; config: Record<string, unknown> | null }>("SELECT provider,model,enabled,encrypted_api_key,config FROM ai_provider_configs WHERE organization_id=$1 AND purpose=$2 ORDER BY provider", [organizationId, "chat"]);
    return NextResponse.json({ providers: result.rows.map((row) => ({ provider: row.provider, model: row.model ?? "", enabled: row.enabled, hasApiKey: Boolean(row.encrypted_api_key?.length), baseUrl: typeof row.config?.baseUrl === "string" ? row.config.baseUrl : "" })) });
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    return authorizationErrorToResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "validation_error", message: "A JSON object is required." }, { status: 422 });
    const organizationId = await orgId(request, body);
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const provider = typeof body.provider === "string" ? body.provider : "";
    const model = typeof body.model === "string" ? body.model.trim().slice(0, 200) : "";
    const suppliedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    let baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    if (!allowed.includes(provider)) return NextResponse.json({ error: "validation_error", message: "A supported provider is required." }, { status: 422 });
    const officialBaseUrl = provider === "gemini" ? "https://generativelanguage.googleapis.com" : provider === "sarvam" ? "https://api.sarvam.ai" : "https://api.openai.com";
    if (baseUrl && baseUrl !== officialBaseUrl) return NextResponse.json({ error: "validation_error", message: "Only the official HTTPS API origin for this provider is allowed in this configuration screen." }, { status: 422 });
    let encrypted: Buffer | null = null;
    if (suppliedKey) {
      const rawKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
      if (!rawKey) return NextResponse.json({ error: "provider_configuration_required", message: "Credential encryption is not configured on the server." }, { status: 503 });
      encrypted = encryptCredential(suppliedKey, parseCredentialsMasterKey(rawKey));
    } else if (body.keepExistingKey !== true) {
      return NextResponse.json({ error: "validation_error", message: "Enter an API key or explicitly keep the existing saved key." }, { status: 422 });
    }
    await query("INSERT INTO ai_provider_configs (organization_id,provider,purpose,model,encrypted_api_key,config,enabled) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT (organization_id,provider,purpose) DO UPDATE SET model=EXCLUDED.model,encrypted_api_key=COALESCE(EXCLUDED.encrypted_api_key,ai_provider_configs.encrypted_api_key),config=EXCLUDED.config,enabled=EXCLUDED.enabled,updated_at=now()", [organizationId, provider, "chat", model || null, encrypted, JSON.stringify({ baseUrl }), body.enabled !== false]);
    return NextResponse.json({ ok: true, message: "Provider settings saved. Secret values are never returned to the browser." });
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    return authorizationErrorToResponse(error);
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const provider = typeof body?.provider === "string" ? body.provider : "";
    if (!body || !allowed.includes(provider)) return NextResponse.json({ error: "validation_error", message: "A supported provider is required." }, { status: 422 });
    const organizationId = await orgId(request, body);
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const result = await query<{ encrypted_api_key: Buffer | null; config: Record<string, unknown> | null }>("SELECT encrypted_api_key,config FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose=$3 AND enabled=true LIMIT 1", [organizationId, provider, "chat"]);
    const saved = result.rows[0];
    if (!saved?.encrypted_api_key) return NextResponse.json({ error: "provider_configuration_required", message: "Save and enable this provider with an API key before fetching its model catalog." }, { status: 409 });
    const rawKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
    if (!rawKey) return NextResponse.json({ error: "provider_configuration_required", message: "Credential encryption is not configured on the server." }, { status: 503 });
    const apiKey = decryptCredential(Buffer.from(saved.encrypted_api_key), parseCredentialsMasterKey(rawKey)).toString("utf8");
    // Compatibility endpoint: the newer GET /api/settings/ai-models uses the
    // same provider adapter. Never return static or bootstrap model IDs.
    try {
      const models = await fetchLiveModelCatalog(provider as "openai" | "gemini" | "sarvam", "chat", apiKey);
      return NextResponse.json({ models, source: "live" }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
      return NextResponse.json({ error: "model_catalog_unavailable", message: "The provider catalogue could not be fetched. No static models are available.", models: [] }, { status: 502 });
    }

  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    if (error instanceof TypeError || (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))) return NextResponse.json({ error: "model_catalog_unavailable", message: "The provider model catalog could not be reached. Check network access and provider settings." }, { status: 502 });
    return authorizationErrorToResponse(error);
  }
}
