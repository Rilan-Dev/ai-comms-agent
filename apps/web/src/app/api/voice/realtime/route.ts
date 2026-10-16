import { NextResponse } from "next/server";
import { PostgresAgentRepository, getVoiceSessionForOrganization } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

function boundedText(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Host-authorized OpenAI Realtime WebRTC SDP exchange.
 * The long-lived provider key remains on the server; the browser only sends
 * its SDP offer and receives the negotiated SDP answer.
 */
export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "realtime_not_configured", message: "OpenAI Realtime is not configured on the server." }, { status: 503 });
    }

    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = boundedText(body?.organizationId, 100);
    const agentId = boundedText(body?.agentId, 100);
    const sessionId = boundedText(body?.sessionId, 100);
    const sdp = typeof body?.sdp === "string" ? body.sdp : "";
    if (!organizationId || !agentId || !sessionId || !sdp || sdp.length > 200_000) {
      return NextResponse.json({ error: "validation_error", message: "organizationId, agentId, sessionId and a valid SDP offer are required." }, { status: 422 });
    }

    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );
    const agent = await new PostgresAgentRepository().get(organizationId, agentId);
    if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id || session.agent_id !== agentId || session.ended_at) {
      return NextResponse.json({ error: "not_found", message: "Voice session was not found for this user and agent." }, { status: 404 });
    }
    if (session.status !== "starting" && session.status !== "active") {
      return NextResponse.json({ error: "session_not_starting", message: "This voice session cannot establish a transport." }, { status: 409 });
    }
    if (String(session.provider ?? "").toLowerCase() !== "openai") {
      return NextResponse.json({ error: "provider_transport_unsupported", message: "The native WebRTC transport is currently available for OpenAI only. This provider has not been connected." }, { status: 409 });
    }

    const model = boundedText(session.model, 160) || process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2.1-mini";
    const voice = boundedText(session.voice_id, 80) || process.env.OPENAI_DEFAULT_VOICE?.trim() || "alloy";
    const sessionConfig = {
      type: "realtime",
      model,
      instructions: [
        "You are Clara, the realtime voice interface for the user's communication workspace.",
        "Do not answer or invent email data directly from this realtime model.",
        "The application sends recognized user speech to its authenticated host turn endpoint, which is the authority for answers and tools.",
        "When the application provides a response instruction, speak the supplied answer clearly and faithfully without adding claims.",
      ].join(" "),
      output_modalities: ["audio"],
      audio: {
        input: {
          transcription: { model: "gpt-4o-mini-transcribe" },
          turn_detection: {
            type: "server_vad",
            create_response: false,
            interrupt_response: false,
          },
        },
        output: { voice },
      },
    };

    const form = new FormData();
    form.set("sdp", sdp);
    form.set("session", JSON.stringify(sessionConfig));
    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      const detail = (await upstream.text().catch(() => "")).slice(0, 500);
      console.error("[voice/realtime] SDP negotiation rejected", { status: upstream.status, model });
      return NextResponse.json({
        error: "realtime_negotiation_failed",
        message: `OpenAI Realtime negotiation failed (${upstream.status}).`,
        detail,
      }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 });
    }
    const answerSdp = await upstream.text();
    if (!answerSdp.trim()) {
      return NextResponse.json({ error: "empty_sdp_answer", message: "Realtime provider returned an empty SDP answer." }, { status: 502 });
    }
    return new Response(answerSdp, { status: 201, headers: { "content-type": "application/sdp; charset=utf-8", "cache-control": "no-store" } });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
