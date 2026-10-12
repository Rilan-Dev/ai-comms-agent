import { NextResponse } from "next/server";
import {
  getOrgAiRuntimeSettings,
  upsertOrgAiRuntimeSettings,
} from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

async function organizationFor(request: Request, body?: Record<string, unknown>) {
  const context = await getAuthenticatedAppContext(request);
  const id = (typeof body?.organizationId === "string" ? body.organizationId.trim() : "") ||
    new URL(request.url).searchParams.get("organizationId")?.trim() || context?.organizationId || "";
  if (!id) throw new Error("An organization context is required.");
  return id;
}

const DEFAULTS = {
  defaultProvider: "openai",
  knowledgeBaseId: "default",
  realtimeVoiceProvider: "openai",
  realtimeVoiceModel: "gpt-realtime-2.1-mini",
  voiceId: "alloy",
  temperature: 0.8,
  maxTokens: 1500,
  systemPrompt: "You are Clara, a helpful AI assistant for the user's communication workspace.",
  voiceChatProvider: null as string | null,
  voiceChatTtsModel: null as string | null,
  voiceChatSttModel: null as string | null,
  voiceChatVoiceId: null as string | null,
  realtimeSttModel: null as string | null,
  realtimeTtsModel: null as string | null,
  embeddingProvider: null as string | null,
  embeddingModel: null as string | null,
  embeddingDimension: null as number | null,
};

export async function GET(request: Request) {
  try {
    const organizationId = await organizationFor(request);
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const settings = await getOrgAiRuntimeSettings(organizationId);
    return NextResponse.json({ settings: settings ?? {
      organizationId,
      ...DEFAULTS,
      updatedAt: new Date().toISOString(),
    }});
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    return authorizationErrorToResponse(error);
  }
}

const ALLOWED_CHAT_PROVIDERS = ["openai", "gemini", "sarvam"];
const ALLOWED_VOICE_CHAT_PROVIDERS = ["openai", "gemini", "sarvam", "elevenlabs"];
const ALLOWED_REALTIME_PROVIDERS = ["openai", "gemini", "sarvam", "elevenlabs"];
const ALLOWED_EMBEDDING_PROVIDERS = ["openai", "gemini", "tei"];

function optionalString(body: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, 1000);
}

function optionalNumber(body: Record<string, unknown>, key: string): number | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "validation_error", message: "A JSON object is required." }, { status: 422 });
    const organizationId = await organizationFor(request, body);
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());

    // Validate each provided field (any subset is allowed — partial update).
    const defaultProvider = optionalString(body, "default_provider");
    if (defaultProvider !== undefined && defaultProvider !== null && !ALLOWED_CHAT_PROVIDERS.includes(defaultProvider)) {
      return NextResponse.json({ error: "validation_error", message: "Unsupported default provider." }, { status: 422 });
    }
    const realtimeVoiceProvider = optionalString(body, "realtime_voice_provider");
    if (realtimeVoiceProvider !== undefined && realtimeVoiceProvider !== null && !ALLOWED_REALTIME_PROVIDERS.includes(realtimeVoiceProvider)) {
      return NextResponse.json({ error: "validation_error", message: "Unsupported realtime voice provider." }, { status: 422 });
    }
    const voiceChatProvider = optionalString(body, "voice_chat_provider");
    if (voiceChatProvider !== undefined && voiceChatProvider !== null && !ALLOWED_VOICE_CHAT_PROVIDERS.includes(voiceChatProvider)) {
      return NextResponse.json({ error: "validation_error", message: "Unsupported voice-chat provider." }, { status: 422 });
    }
    const embeddingProvider = optionalString(body, "embedding_provider");
    if (embeddingProvider !== undefined && embeddingProvider !== null && !ALLOWED_EMBEDDING_PROVIDERS.includes(embeddingProvider)) {
      return NextResponse.json({ error: "validation_error", message: "Unsupported embedding provider." }, { status: 422 });
    }
    const temperature = optionalNumber(body, "temperature");
    if (temperature !== undefined && temperature !== null && (temperature < 0 || temperature > 2)) {
      return NextResponse.json({ error: "validation_error", message: "Temperature must be between 0 and 2." }, { status: 422 });
    }
    const maxTokens = optionalNumber(body, "max_tokens");
    if (maxTokens !== undefined && maxTokens !== null && (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 32768)) {
      return NextResponse.json({ error: "validation_error", message: "Maximum output tokens must be between 1 and 32768." }, { status: 422 });
    }
    const embeddingDimension = optionalNumber(body, "embedding_dimension");
    if (embeddingDimension !== undefined && embeddingDimension !== null && (embeddingDimension < 1 || embeddingDimension > 4096)) {
      return NextResponse.json({ error: "validation_error", message: "Embedding dimension must be between 1 and 4096." }, { status: 422 });
    }

    // Snake-case → camelCase mapping for the repository.
    await upsertOrgAiRuntimeSettings(organizationId, {
      defaultProvider,
      knowledgeBaseId: optionalString(body, "knowledge_base_id"),
      realtimeVoiceProvider,
      realtimeVoiceModel: optionalString(body, "realtime_voice_model"),
      voiceId: optionalString(body, "voice_id"),
      temperature,
      maxTokens,
      systemPrompt: optionalString(body, "system_prompt"),
      voiceChatProvider,
      voiceChatTtsModel: optionalString(body, "voice_chat_tts_model"),
      voiceChatSttModel: optionalString(body, "voice_chat_stt_model"),
      voiceChatVoiceId: optionalString(body, "voice_chat_voice_id"),
      realtimeSttModel: optionalString(body, "realtime_stt_model"),
      realtimeTtsModel: optionalString(body, "realtime_tts_model"),
      embeddingProvider,
      embeddingModel: optionalString(body, "embedding_model"),
      embeddingDimension,
      updatedBy: actor.user.id,
    });
    return NextResponse.json({ ok: true, message: "AI runtime configuration saved." });
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    return authorizationErrorToResponse(error);
  }
}
