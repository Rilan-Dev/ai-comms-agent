import { NextResponse } from "next/server";
import { getDecryptedProviderConfig } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { fetchLiveModelCatalog, supportsLiveCatalog, type LiveModelProvider, type LiveModelPurpose } from "@/lib/ai/live-model-catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/ai-models?organizationId=...&provider=openai&purpose=chat
 *
 * Credentials are loaded exclusively from the requesting organization's
 * encrypted, enabled provider configuration. No static catalogue, env-wide
 * key, or untrusted base URL is used. Unsupported vendor catalogues are
 * reported, not fabricated.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const context = await getAuthenticatedAppContext(request);
    const organizationId = params.get("organizationId")?.trim() || context?.organizationId || "";
    const provider = params.get("provider")?.trim().toLowerCase() || "";
    const purpose = params.get("purpose")?.trim().toLowerCase() || "chat";

    if (!organizationId) {
      return NextResponse.json({ error: "validation_error", message: "An organization context is required." }, { status: 422 });
    }
    // Do not disclose provider credentials, or even catalogue availability,
    // to unauthenticated or cross-organization callers.
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    if (!supportsLiveCatalog(provider, purpose)) {
      return NextResponse.json({
        error: "catalog_unsupported",
        message: "This provider does not publish a live model listing for this capability. No static model list is substituted.",
        models: [],
      }, { status: 422 });
    }
    const saved = await getDecryptedProviderConfig(organizationId, provider, purpose as LiveModelPurpose);
    if (!saved?.enabled || !saved.apiKey) {
      return NextResponse.json({
        error: "provider_configuration_required",
        message: "Save and enable this provider's API key for this capability before loading live models.",
        models: [],
      }, { status: 409 });
    }

    try {
      const models = await fetchLiveModelCatalog(provider as LiveModelProvider, purpose as LiveModelPurpose, saved.apiKey);
      return NextResponse.json({ models, provider, purpose, source: "live" }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch {
      return NextResponse.json({
        error: "model_catalog_unavailable",
        message: "The provider model catalogue is unavailable. Retry after checking provider access; no static models will be shown.",
        models: [],
      }, { status: 502 });
    }
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
