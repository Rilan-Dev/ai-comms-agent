import { NextResponse } from "next/server";
import { query } from "@ai-comms-agent/db";
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

export async function GET(request: Request) {
  try {
    const organizationId = await organizationFor(request);
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const result = await query<Record<string, unknown>>("SELECT * FROM organization_ai_runtime_settings WHERE organization_id=$1", [organizationId]);
    return NextResponse.json({ settings: result.rows[0] ?? {
      organization_id: organizationId, default_provider: "openai", knowledge_base_id: "",
      realtime_voice_provider: "openai", realtime_voice_model: "gpt-realtime-2.1-mini",
      voice_id: "alloy", temperature: 0.8, max_tokens: 1500,
      system_prompt: "You are Clara, a helpful AI assistant for the user's communication workspace."
    }});
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    return authorizationErrorToResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "validation_error", message: "A JSON object is required." }, { status: 422 });
    const organizationId = await organizationFor(request, body);
    const actor = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const provider = typeof body.default_provider === "string" ? body.default_provider : "openai";
    const voiceProvider = typeof body.realtime_voice_provider === "string" ? body.realtime_voice_provider : "openai";
    const kbId = typeof body.knowledge_base_id === "string" ? body.knowledge_base_id.trim().slice(0, 300) : "";
    const voiceModel = typeof body.realtime_voice_model === "string" ? body.realtime_voice_model.trim().slice(0, 200) : "gpt-realtime-2.1-mini";
    const voiceId = typeof body.voice_id === "string" ? body.voice_id.trim().slice(0, 200) : "alloy";
    const temperature = Number(body.temperature ?? 0.8);
    const maxTokens = Number(body.max_tokens ?? 1500);
    const prompt = typeof body.system_prompt === "string" ? body.system_prompt.trim().slice(0, 12000) : "";
    if (!["openai","gemini","sarvam"].includes(provider)) return NextResponse.json({ error: "validation_error", message: "Unsupported default provider." }, { status: 422 });
    if (!["openai","gemini","sarvam","elevenlabs"].includes(voiceProvider)) return NextResponse.json({ error: "validation_error", message: "Unsupported realtime voice provider." }, { status: 422 });
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) return NextResponse.json({ error: "validation_error", message: "Temperature must be between 0 and 2." }, { status: 422 });
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 32768) return NextResponse.json({ error: "validation_error", message: "Maximum output tokens must be between 1 and 32768." }, { status: 422 });
    await query("INSERT INTO organization_ai_runtime_settings (organization_id,default_provider,knowledge_base_id,realtime_voice_provider,realtime_voice_model,voice_id,temperature,max_tokens,system_prompt,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (organization_id) DO UPDATE SET default_provider=EXCLUDED.default_provider,knowledge_base_id=EXCLUDED.knowledge_base_id,realtime_voice_provider=EXCLUDED.realtime_voice_provider,realtime_voice_model=EXCLUDED.realtime_voice_model,voice_id=EXCLUDED.voice_id,temperature=EXCLUDED.temperature,max_tokens=EXCLUDED.max_tokens,system_prompt=EXCLUDED.system_prompt,updated_by=EXCLUDED.updated_by,updated_at=now()", [organizationId, provider, kbId, voiceProvider, voiceModel, voiceId, temperature, maxTokens, prompt || "You are Clara, a helpful AI assistant for the user's communication workspace.", actor.user.id]);
    return NextResponse.json({ ok: true, message: "AI runtime settings saved." });
  } catch (error) {
    if (error instanceof Error && error.message === "An organization context is required.") return NextResponse.json({ error: "configuration_required", message: error.message }, { status: 422 });
    return authorizationErrorToResponse(error);
  }
}
