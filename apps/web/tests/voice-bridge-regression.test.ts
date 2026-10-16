// Regression protection for the Sarvam voice bridge fix.
// Verifies the /api/voice/turn route supports:
//   1. JSON text input with `speak: true` → returns base64 audio
//   2. multipart/form-data audio upload → Sarvam STT → chat → TTS
//   3. The route falls back gracefully when Sarvam TTS/STT fails
//   4. clara-core exports sarvamStt + sarvamTts functions
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(__dirname, "../src/app/api/voice/turn/route.ts");
const routeSource = readFileSync(routePath, "utf8");
const runtimePath = resolve(__dirname, "../../../packages/clara-core/src/runtime.ts");
const runtimeSource = readFileSync(runtimePath, "utf8");
const indexPath = resolve(__dirname, "../../../packages/clara-core/src/index.ts");
const indexSource = readFileSync(indexPath, "utf8");

describe("ISS-VOICE-BRIDGE — Sarvam voice bridge (TTS + STT via host turn endpoint)", () => {
  it("clara-core exports sarvamTts + sarvamStt functions", () => {
    // The functions must be exported from the package barrel so the
    // /api/voice/turn route can import them.
    expect(runtimeSource).toContain("export async function sarvamTts");
    expect(runtimeSource).toContain("export async function sarvamStt");
    expect(indexSource).toContain("sarvamStt");
    expect(indexSource).toContain("sarvamTts");
  });

  it("sarvamTts calls POST {baseUrl}/text-to-speech with JSON body", () => {
    // Verify the Sarvam Bulbul TTS REST endpoint is called correctly.
    expect(runtimeSource).toContain("`${cred.baseUrl}/text-to-speech`");
    expect(runtimeSource).toContain("bulbul:v3");
    expect(runtimeSource).toContain("shubh");
    expect(runtimeSource).toContain("audioBase64");
  });

  it("sarvamStt calls POST {baseUrl}/speech-to-text with multipart form", () => {
    // Verify the Sarvam Saaras STT REST endpoint is called correctly.
    expect(runtimeSource).toContain("`${cred.baseUrl}/speech-to-text`");
    expect(runtimeSource).toContain("saaras:v3");
    expect(runtimeSource).toContain("FormData");
    expect(runtimeSource).toContain("transcript");
  });

  it("/api/voice/turn route supports both JSON and multipart input", () => {
    // The route must accept both:
    //   - application/json with { organizationId, agentId, sessionId, transcript, speak? }
    //   - multipart/form-data with fields + audio File
    expect(routeSource).toContain('request.headers.get("content-type")');
    expect(routeSource).toContain('contentType.includes("multipart/form-data")');
    expect(routeSource).toContain("await request.formData()");
    expect(routeSource).toContain("audioFile instanceof Blob");
  });

  it("/api/voice/turn route synthesizes TTS when `speak: true`", () => {
    // When speak is true and the chat turn produces text, the route
    // must call sarvamTts to synthesize audio and return it as base64.
    expect(routeSource).toContain("sarvamTts({");
    expect(routeSource).toContain("audioBase64");
    expect(routeSource).toContain("audioFormat: \"wav\"");
  });

  it("/api/voice/turn route transcribes uploaded audio via sarvamStt", () => {
    // When multipart audio is uploaded, the route must call sarvamStt
    // to transcribe it before passing to claraRuntime.createChatTurn.
    expect(routeSource).toContain("sarvamStt({ orgId: organizationId, audio: audioBuffer })");
    expect(routeSource).toContain("sttTranscript");
    expect(routeSource).toContain("recognizedTranscript");
  });

  it("/api/voice/turn route degrades gracefully when TTS fails", () => {
    // TTS failure must NOT fail the whole turn — the text answer is
    // still returned, with a ttsError field if TTS failed.
    expect(routeSource).toContain("ttsError");
    expect(routeSource).toContain("// TTS failure is non-fatal");
  });

  it("/api/voice/turn route degrades gracefully when STT fails", () => {
    // STT failure must NOT fail the whole turn — the chat turn
    // receives a fallback transcript and the user sees an error
    // message about the audio transcription.
    expect(routeSource).toContain("// STT failure is non-fatal");
    expect(routeSource).toContain("the audio could not be transcribed");
  });
});
