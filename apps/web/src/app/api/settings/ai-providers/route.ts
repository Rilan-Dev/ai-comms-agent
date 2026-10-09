import { NextResponse } from "next/server";
import { encryptCredential, parseCredentialsMasterKey, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

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
    if (!allowed.includes(provider) || !model) return NextResponse.json({ error: "validation_error", message: "A supported provider and model are required." }, { status: 422 });
    if (baseUrl && !baseUrl.startsWith("https://")) return NextResponse.json({ error: "validation_error", message: "Provider base URL must use HTTPS." }, { status: 422 });
    let encrypted: Buffer | null = null;
    if (suppliedKey) {
      const rawKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
      if (!rawKey) return NextResponse.json({ error: "provider_configuration_required", message: "Credential encryption is not configured on the server." }, { status: 503 });
      encrypted = encryptCredential(suppliedKey, parseCredentialsMasterKey(rawKey));
    } else if (body.keepExistingKey !== true) {
      return NextResponse.json({ error: "validation_error", message: "Enter an API key or explicitly keep the existing saved key." }, { status: 422 });
    }
    await query("INSERT INTO ai_provider_configs (organization_id,provider,purpose,model,encrypted_api_key,config,enabled) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT (organization_id,provider,purpose) DO UPDATE SET model=EXCLUDED.model,encrypted_api_key=COALESCE(EXCLUDED.encrypted_api_key,ai_provider_configs.encrypted_api_key),config=EXCLUDED.config,enabled=EXCLUDED.enabled,updated_at=now()", [organizationId, provider, "chat", model, encrypted, JSON.stringify({ baseUrl }), body.enabled !== false]);
    return NextResponse.json({ ok: true, message: "Provider settings saved. Secret values are never returned to the browser." });
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    return authorizationErrorToResponse(error);
  }
}
