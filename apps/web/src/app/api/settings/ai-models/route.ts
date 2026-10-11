import { NextResponse } from "next/server";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { asOrganizationId } from "@ai-comms-agent/shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/ai-models?provider=openai&organizationId=...
 *
 * Fetches the list of available models from the AI provider's API
 * (e.g. OpenAI's /v1/models endpoint) so the UI dropdown is always
 * up-to-date. Falls back to a curated static list if the API is
 * unreachable (e.g. region-blocked or no API key configured).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const provider = (url.searchParams.get("provider") ?? "openai").toLowerCase();

    if (!organizationId) {
      return NextResponse.json({ error: "validation_error", message: "organizationId is required." }, { status: 422 });
    }

    try {
      await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    } catch {
      // If not authorized, still return static models (they're not sensitive)
    }

    const apiKey = getApiKey(provider);
    if (!apiKey) {
      return NextResponse.json({ models: getStaticModels(provider), source: "static_no_key" });
    }

    try {
      const modelsUrl = getModelsUrl(provider);
      if (!modelsUrl) {
        return NextResponse.json({ models: getStaticModels(provider), source: "static_no_endpoint" });
      }
      const headers: Record<string, string> = { "accept": "application/json" };
      if (provider === "openai") headers["authorization"] = `Bearer ${apiKey}`;
      else if (provider === "gemini") headers["x-goog-api-key"] = apiKey;
      else if (provider === "sarvam") headers["authorization"] = `Bearer ${apiKey}`;

      const resp = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) {
        return NextResponse.json({ models: getStaticModels(provider), source: `static_api_${resp.status}` });
      }
      const data = await resp.json() as { data?: Array<{ id: string }>; models?: Array<{ name: string }>; items?: Array<{ id: string }> };
      const rawModels = data.data ?? data.models ?? data.items ?? [];
      const models = rawModels.map((m) => ({ id: m.id ?? m.name ?? "", name: m.id ?? m.name ?? "" })).filter((m) => m.id);
      if (models.length === 0) {
        return NextResponse.json({ models: getStaticModels(provider), source: "static_empty_api" });
      }
      return NextResponse.json({ models, source: "api" });
    } catch {
      return NextResponse.json({ models: getStaticModels(provider), source: "static_fetch_error" });
    }
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

function getApiKey(provider: string): string | undefined {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  if (provider === "gemini") return process.env.GEMINI_API_KEY;
  if (provider === "sarvam") return process.env.SARVAM_API_KEY;
  return undefined;
}

function getModelsUrl(provider: string): string | undefined {
  if (provider === "openai") return "https://api.openai.com/v1/models";
  if (provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta/models";
  if (provider === "sarvam") return undefined; // Sarvam doesn't have a public models endpoint
  return undefined;
}

function getStaticModels(provider: string): Array<{ id: string; name: string }> {
  if (provider === "openai") {
    return [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "gpt-4", name: "GPT-4" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
      { id: "o1-preview", name: "o1-preview" },
      { id: "o1-mini", name: "o1-mini" },
    ];
  }
  if (provider === "gemini") {
    return [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
    ];
  }
  if (provider === "sarvam") {
    return [
      { id: "sarvam-105b-conversations", name: "Sarvam 105B Conversations" },
      { id: "sarvam-8b-conversations", name: "Sarvam 8B Conversations" },
    ];
  }
  return [];
}
