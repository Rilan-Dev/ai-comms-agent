import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) => readFileSync(resolve(__dirname, file), "utf8");
const chat = read("../src/app/chat/chat-client.tsx");
const chatRoute = read("../src/app/api/chat/stream/route.ts");
const voice = read("../src/app/ai-voice/voice-workspace.tsx");
const voiceRoute = read("../src/app/api/voice/turn/route.ts");
const runtimeSource = read("../../../packages/agent-core/src/runtime.ts");

describe("Chat and realtime Voice progressive generation", () => {
  it("starts chat SSE before generation and publishes only a host-checked final answer", () => {
    const stream = chatRoute.slice(chatRoute.indexOf("const shouldResolveTools ="));
    expect(stream).toContain('emit("conversation"');
    expect(stream).toContain('emit("status", { phase: "generating" })');
    expect(stream).toContain('for await (const chunk of turn.stream)');
    expect(stream).toContain("userFacingChatAnswer(");
    expect(stream).toContain('emit("delta", { text: assistantOutput })');
    expect(stream).toContain('emit("done", { conversationId');
    expect(stream).toContain('"x-accel-buffering": "no"');
  });

  it("never invokes unapproved email/WhatsApp tools on the direct model streaming path", () => {
    expect(chatRoute).toContain("const shouldResolveTools");
    expect(chatRoute).toContain("asksAboutEmail(combinedSearchContext)");
    expect(chatRoute).toContain("asksAboutWhatsApp(combinedSearchContext)");
    expect(chatRoute).toContain("runInteractiveHostToolLoop");
    expect(chatRoute).toContain("toolContext: trustedToolContext");
    expect(chatRoute).toContain('emit("status", { phase: "tools" })');
    expect(chatRoute).not.toContain("setTimeout(");
  });

  it("assembles chunked responses immediately and refuses incomplete chat EOF", () => {
    expect(chat).toContain("readSseEvents(response.body)");
    expect(chat).toContain("assistant += payload.text");
    expect(chat).toContain("setResponseStarted(true)");
    expect(chat).toContain("if (!completed) throw new Error");
    expect(chat).toContain("Streaming response…");
    expect(chat).not.toContain("buffer.split(\"\\n\\n\")");
  });

  it("authorizes a real voice session before either streaming or executing tools", () => {
    const session = voiceRoute.indexOf("await getVoiceSessionForOrganization(");
    const stream = voiceRoute.indexOf('request.headers.get("accept")?.includes("text/event-stream")');
    expect(session).toBeGreaterThan(0);
    expect(stream).toBeGreaterThan(session);
    expect(voiceRoute).toContain("session.user_id !== subject.user.id");
    expect(voiceRoute).toContain("incrementVoiceSessionTurnForOrganization(");
    expect(voiceRoute).toContain("needsAuthorizedTools");
    expect(voiceRoute).toContain("await runEmailAgentTurn(");
    expect(voiceRoute).toContain('channel: "voice"');
    expect(voiceRoute).toContain("maxToolCalls: 8");
  });

  it("validates complete non-tool voice output before emission and preserves the JSON contract", () => {
    expect(voiceRoute).toContain('surface: "realtime"');
    expect(voiceRoute).toContain("for await (const token of generation.stream)");
    expect(voiceRoute).toContain('generated += token');
    expect(voiceRoute).toContain('currentTurnOperationAnswer(validated, [], executionId, explicitEmailAction)');
    expect(voiceRoute).toContain('emit("delta", { text: verifiedAnswer })');
    expect(voiceRoute).not.toContain('emit("delta", { text: token })');
    expect(voiceRoute).toContain('mode: "model-stream"');
    expect(voiceRoute).toContain('mode: "host-authorized-tools"');
    expect(voiceRoute).toContain("return NextResponse.json({");
  });

  it("updates visible voice text per delta, preserves partial errors and starts audio only after completed answer", () => {
    expect(voice).toContain('accept: "text/event-stream"');
    expect(voice).toContain("for await (const event of readSseEvents(response.body))");
    expect(voice).toContain('state: "streaming"');
    expect(voice).toContain("streamedText += message.text");
    expect(voice).toContain("if (!complete) throw new Error");
    expect(voice).toContain("Response interrupted:");
    expect(voice).toContain("streamProviderTts(answer, generationId)");
  });

  it("uses native Gemini SSE instead of buffering generateContent JSON", () => {
    const gemini = runtimeSource.slice(runtimeSource.indexOf("async function geminiStream("), runtimeSource.indexOf("async function chatStream("));
    expect(gemini).toContain("streamGenerateContent?alt=sse");
    expect(gemini).toContain("response.body.getReader()");
    expect(gemini).toContain("if (text) yield text");
    expect(gemini).not.toContain("await response.json()");
  });
});
