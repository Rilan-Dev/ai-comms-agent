import { NextResponse } from "next/server";
import { PostgresAgentRepository, getVoiceSessionForOrganization, incrementVoiceSessionTurnForOrganization, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { claraRuntime, sarvamStt, sarvamTts } from "@ai-comms-agent/clara-core";

export const dynamic = "force-dynamic";

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for voice turns." }, { status: 503 });
    }

    await ensureDevSeed();

    // Two input modes:
    //   1. JSON { organizationId, agentId, sessionId, transcript, speak? }
    //      — user typed text in the voice workspace text bridge
    //   2. multipart/form-data with fields:
    //        organizationId, agentId, sessionId, audio (File), speak="1"
    //      — user recorded audio (push-to-talk) and uploaded the blob
    // The route detects the content-type to pick the right path.
    const contentType = request.headers.get("content-type") ?? "";
    let organizationId: string;
    let agentId: string;
    let sessionId: string;
    let transcript: string;
    let speak: boolean;
    let audioBuffer: Buffer | null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      organizationId = text(form.get("organizationId"), 100);
      agentId = text(form.get("agentId"), 100);
      sessionId = text(form.get("sessionId"), 100);
      speak = String(form.get("speak") ?? "1") === "1";
      const audioFile = form.get("audio");
      if (!(audioFile instanceof Blob)) {
        return NextResponse.json({ error: "validation_error", message: "multipart upload requires an 'audio' file field." }, { status: 422 });
      }
      const arrayBuf = await audioFile.arrayBuffer();
      audioBuffer = Buffer.from(new Uint8Array(arrayBuf));
      // Transcript will be filled after Sarvam STT transcription below.
      transcript = "";
    } else {
      const body = await request.json().catch(() => null);
      organizationId = text(body?.organizationId, 100);
      agentId = text(body?.agentId, 100);
      sessionId = text(body?.sessionId, 100);
      transcript = text(body?.transcript);
      speak = Boolean(body?.speak);
      audioBuffer = null;
    }

    if (!organizationId || !agentId || !sessionId) {
      return NextResponse.json(
        { error: "validation_error", message: "organizationId, agentId and sessionId are required." },
        { status: 422 },
      );
    }
    if (!transcript && !audioBuffer) {
      return NextResponse.json(
        { error: "validation_error", message: "Either 'transcript' (JSON) or 'audio' (multipart file) is required." },
        { status: 422 },
      );
    }

    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    const agent = await new PostgresAgentRepository().get(organizationId, agentId);
    if (!agent) return NextResponse.json({ error: "not_found", message: "Agent was not found in this organization." }, { status: 404 });

    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id || session.agent_id !== agentId) {
      return NextResponse.json({ error: "not_found", message: "Voice session was not found for this user and agent." }, { status: 404 });
    }
    const transcriptBridgeOnly =
      session.status === "starting" &&
      (session.metadata as Record<string, unknown> | null)?.transportMode === "transcript_bridge";
    if ((session.status !== "active" && !transcriptBridgeOnly) || session.ended_at) {
      return NextResponse.json({ error: "session_not_active", message: "Voice turns require a connected session or an explicitly initialized transcript bridge." }, { status: 409 });
    }

    const runtimeSettings = await query<{ knowledge_base_id: string }>("SELECT knowledge_base_id FROM organization_ai_runtime_settings WHERE organization_id = $1", [organizationId]);
    // KB ID is OPTIONAL for voice turns. RAG features are skipped when no KB is configured.
    const kbId = runtimeSettings.rows[0]?.knowledge_base_id?.trim() || process.env.CLARA_KB_ID?.trim() || "default";

    // If audio was uploaded, transcribe it via Sarvam STT first.
    let sttTranscript: string | null = null;
    let sttLanguageCode: string | null = null;
    if (audioBuffer) {
      try {
        const stt = await sarvamStt({ orgId: organizationId, audio: audioBuffer });
        sttTranscript = stt.transcript;
        sttLanguageCode = stt.languageCode;
        if (sttTranscript) transcript = sttTranscript;
      } catch (sttError) {
        // STT failure is non-fatal — fall back to empty transcript so the
        // chat turn returns an "I couldn't hear you" type response.
        console.error("[voice/turn] Sarvam STT failed:", sttError instanceof Error ? sttError.message : String(sttError));
        transcript = "(the audio could not be transcribed)";
      }
    }

    const executionId = crypto.randomUUID();
    const turn = await claraRuntime.createChatTurn({
      orgId: organizationId,
      agentId,
      kbId,
      userId: subject.user.id,
      sessionId,
      surface: "chat",
      ragMode: "hybrid",
      messages: [
        {
          role: "user",
          content: transcript,
        },
      ],
    });

    let output = "";
    for await (const chunk of turn.stream) output += chunk;

    // If `speak` was requested, synthesize TTS audio via Sarvam Bulbul.
    // Returns base64-encoded WAV audio in the JSON response — the browser
    // plays it via the <audio> element. This gives Sarvam-configured agents
    // a working voice experience without porting the full Sarvam realtime
    // WebSocket relay from vendor/clara.
    let audioBase64: string | undefined;
    let ttsError: string | undefined;
    if (speak && output.trim()) {
      try {
        const tts = await sarvamTts({
          orgId: organizationId,
          text: output,
          // Use the STT-detected language if available; otherwise let Sarvam
          // Bulbul default to its multilingual mode.
          ...(sttLanguageCode ? { languageCode: sttLanguageCode } : {}),
        });
        audioBase64 = tts.audioBase64;
      } catch (ttsErr) {
        // TTS failure is non-fatal — the text answer is still useful.
        ttsError = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
        console.error("[voice/turn] Sarvam TTS failed:", ttsError);
      }
    }

    const turnRecorded = await incrementVoiceSessionTurnForOrganization(organizationId, sessionId, transcriptBridgeOnly);
    if (!turnRecorded) {
      return NextResponse.json({ error: "session_not_active", message: "Voice session ended before the turn could be recorded." }, { status: 409 });
    }
    return NextResponse.json({
      executionId,
      text: output,
      provider: turn.providerName,
      model: turn.model,
      actions: [],
      ...(sttTranscript ? { recognizedTranscript: sttTranscript } : {}),
      ...(audioBase64 ? { audioBase64, audioFormat: "wav" as const, audioSampleRate: 16_000 } : {}),
      ...(ttsError ? { ttsError } : {}),
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
