import { NextResponse } from "next/server";
import {
  PostgresAgentRepository,
  getAgentAiSettings,
  upsertAgentAiSettings,
} from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/agents/[id]/ai-settings?organizationId=...
 * Returns the per-agent AI settings. NULL fields mean "inherit org defaults".
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const orgId = new URL(request.url).searchParams.get("organizationId");
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    await authorize(request, { organizationId: asOrganizationId(orgId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const repo = new PostgresAgentRepository();
    const agent = await repo.get(orgId, id);
    if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const aiSettings = await getAgentAiSettings(orgId, id);
    return NextResponse.json({ aiSettings });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

/**
 * PUT /api/agents/[id]/ai-settings
 * Body: {
 *   chatProvider, chatModel,
 *   voiceChatProvider, voiceChatTtsModel, voiceChatSttModel, voiceChatVoiceId,
 *   realtimeVoiceProviderOverride, realtimeSttModel, realtimeTtsModel, realtimeVoiceIdOverride,
 *   embeddingProvider, embeddingModel, embeddingDimension,
 *   systemPromptOverride, temperatureOverride, maxTokensOverride,
 * }
 * Every field is OPTIONAL — explicitly pass null to clear an override.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required." }, { status: 503 });
    await ensureDevSeed();
    const { id } = await params;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "validation_error", message: "A JSON object is required." }, { status: 422 });
    const orgId = typeof body.organizationId === "string" ? body.organizationId.trim() : (new URL(request.url).searchParams.get("organizationId")?.trim() ?? "");
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    await authorize(request, { organizationId: asOrganizationId(orgId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const repo = new PostgresAgentRepository();
    const agent = await repo.get(orgId, id);
    if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Coerce body values into the right types. NULL is allowed for every field
    // so callers can explicitly clear an override by passing null.
    const toNullableString = (v: unknown): string | null => {
      if (v === null || v === undefined) return null;
      if (typeof v !== "string") return null;
      const trimmed = v.trim();
      return trimmed.length === 0 ? null : trimmed.slice(0, 1000);
    };
    const toNullableNumber = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const saved = await upsertAgentAiSettings({
      organizationId: orgId,
      agentId: id,
      chatProvider: toNullableString(body.chatProvider),
      chatModel: toNullableString(body.chatModel),
      voiceChatProvider: toNullableString(body.voiceChatProvider),
      voiceChatTtsModel: toNullableString(body.voiceChatTtsModel),
      voiceChatSttModel: toNullableString(body.voiceChatSttModel),
      voiceChatVoiceId: toNullableString(body.voiceChatVoiceId),
      realtimeVoiceProviderOverride: toNullableString(body.realtimeVoiceProviderOverride),
      realtimeSttModel: toNullableString(body.realtimeSttModel),
      realtimeTtsModel: toNullableString(body.realtimeTtsModel),
      realtimeVoiceIdOverride: toNullableString(body.realtimeVoiceIdOverride),
      embeddingProvider: toNullableString(body.embeddingProvider),
      embeddingModel: toNullableString(body.embeddingModel),
      embeddingDimension: toNullableNumber(body.embeddingDimension),
      systemPromptOverride: toNullableString(body.systemPromptOverride),
      temperatureOverride: toNullableNumber(body.temperatureOverride),
      maxTokensOverride: toNullableNumber(body.maxTokensOverride),
    });
    return NextResponse.json({ ok: true, aiSettings: saved });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
