import { NextResponse } from "next/server";
import {
  deleteProviderConfig,
  listProviderConfigs,
  upsertProviderConfig,
} from "@ai-comms-agent/db";
import {
  asOrganizationId,
  type AiPurpose,
} from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

const ALLOWED_PROVIDERS: Record<AiPurpose, string[]> = {
  chat: ["openai", "gemini", "sarvam"],
  tts: ["elevenlabs", "sarvam"],
  stt: ["elevenlabs", "sarvam"],
  realtime: ["openai", "gemini", "sarvam", "elevenlabs"],
  embedding: ["openai", "gemini", "tei"],
  general: ["openai", "gemini", "sarvam", "elevenlabs"],
};

const OFFICIAL_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com",
  gemini: "https://generativelanguage.googleapis.com",
  sarvam: "https://api.sarvam.ai",
  elevenlabs: "https://api.elevenlabs.io",
  tei: "",
};

async function orgId(request: Request, body?: Record<string, unknown>) {
  const context = await getAuthenticatedAppContext(request);
  const supplied = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
  const fromQuery = new URL(request.url).searchParams.get("organizationId")?.trim() ?? "";
  const id = supplied || fromQuery || context?.organizationId || "";
  if (!id) throw new Error("An organization context is required.");
  return id;
}

function parsePurpose(value: unknown): AiPurpose | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (["chat", "tts", "stt", "realtime", "embedding", "general"].includes(v)) {
    return v as AiPurpose;
  }
  return null;
}

/**
 * GET /api/settings/ai-provider-configs?purpose=chat
 * Returns the list of saved provider configs for the given purpose.
 * If purpose is omitted, returns all configs for the org.
 */
export async function GET(request: Request) {
  try {
    const organizationId = await orgId(request);
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const purposeParam = new URL(request.url).searchParams.get("purpose");
    const purpose: AiPurpose | undefined = purposeParam ? (parsePurpose(purposeParam) ?? undefined) : undefined;
    if (purposeParam && !purpose) {
      return NextResponse.json({ error: "validation_error", message: "Invalid purpose. Allowed: chat, tts, stt, realtime, embedding, general." }, { status: 422 });
    }
    const configs = await listProviderConfigs(organizationId, purpose);
    return NextResponse.json({ configs });
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") {
      return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    }
    return authorizationErrorToResponse(error);
  }
}

/**
 * PUT /api/settings/ai-provider-configs
 * Body: { purpose, provider, model, apiKey, baseUrl, enabled }
 * Saves (upserts) a provider config. When apiKey is empty, caller MUST also
 * pass keepExistingKey: true — the existing key is preserved.
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "validation_error", message: "A JSON object is required." }, { status: 422 });
    const organizationId = await orgId(request, body);
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());

    const purpose = parsePurpose(body.purpose);
    if (!purpose) {
      return NextResponse.json({ error: "validation_error", message: "purpose is required (chat | tts | stt | realtime | embedding)." }, { status: 422 });
    }
    const provider = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
    if (!ALLOWED_PROVIDERS[purpose].includes(provider)) {
      return NextResponse.json({ error: "validation_error", message: `Provider "${provider}" is not allowed for purpose "${purpose}".` }, { status: 422 });
    }
    const model = typeof body.model === "string" ? body.model.trim().slice(0, 200) : "";
    const suppliedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    let baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    const keepExistingKey = body.keepExistingKey === true;
    if (!suppliedKey && !keepExistingKey) {
      return NextResponse.json({ error: "validation_error", message: "Enter an API key or explicitly keep the existing saved key." }, { status: 422 });
    }
    const officialBase = OFFICIAL_BASE_URLS[provider] ?? "";
    if (baseUrl && officialBase && baseUrl !== officialBase) {
      return NextResponse.json({ error: "validation_error", message: `Only the official HTTPS API origin for ${provider} is allowed in this configuration screen (${officialBase}).` }, { status: 422 });
    }
    const saved = await upsertProviderConfig({
      organizationId,
      provider,
      purpose,
      model: model || null,
      baseUrl: baseUrl || null,
      apiKey: suppliedKey || undefined,
      enabled: body.enabled !== false,
    });
    return NextResponse.json({ ok: true, message: "Provider settings saved. Secret values are never returned to the browser.", config: { provider: saved.provider, purpose: saved.purpose, model: saved.model, enabled: saved.enabled, hasApiKey: saved.hasApiKey, baseUrl: saved.baseUrl } });
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") {
      return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    }
    if (error instanceof Error && error.message.includes("CREDENTIALS_MASTER_KEY")) {
      return NextResponse.json({ error: "provider_configuration_required", message: error.message }, { status: 503 });
    }
    return authorizationErrorToResponse(error);
  }
}

/**
 * DELETE /api/settings/ai-provider-configs?purpose=chat&provider=openai
 * Removes a provider config and its encrypted key.
 */
export async function DELETE(request: Request) {
  try {
    const organizationId = await orgId(request);
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const url = new URL(request.url);
    const purpose = parsePurpose(url.searchParams.get("purpose"));
    const provider = url.searchParams.get("provider")?.trim().toLowerCase() ?? "";
    if (!purpose || !provider) {
      return NextResponse.json({ error: "validation_error", message: "Both purpose and provider are required." }, { status: 422 });
    }
    const deleted = await deleteProviderConfig(organizationId, provider, purpose);
    if (!deleted) {
      return NextResponse.json({ error: "not_found", message: "No provider config matched." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") {
      return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    }
    return authorizationErrorToResponse(error);
  }
}

/**
 * Removed the static catalogue endpoint. Consumers must use the authorized
 * /api/settings/ai-models vendor-live endpoint and explicitly handle failures.
 */
export async function POST() {
  return NextResponse.json({
    error: "catalog_endpoint_retired",
    message: "The static catalogue is retired. Use GET /api/settings/ai-models?provider=...&purpose=...&organizationId=... for live models.",
  }, { status: 410 });
}
