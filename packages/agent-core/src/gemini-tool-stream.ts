import type { ChatToolCompletion, GeminiModelPart } from "./types";

/**
 * Assemble Gemini streamGenerateContent SSE tool decisions without executing
 * any tool. Gemini functionCall arguments are JSON objects, not the OpenAI
 * string fragments. Repeated identical parts are deduplicated; conflicting
 * partially updated function-call snapshots fail closed.
 */
const MAX_EVENT = 256_000;
const MAX_TEXT = 64_000;
const MAX_CALLS = 32;
const MAX_ARGUMENTS = 16_000;
const MAX_THOUGHT_SIGNATURE = 16_000;
const invalid = (reason: "invalid_tool_call" | "invalid_tool_arguments"): ChatToolCompletion => ({
  text: "I couldn't safely interpret the requested operation, so I did not execute it. Please rephrase the request.",
  toolCalls: [],
  finishReason: reason,
});

type GeminiPart = { text?: string; thought?: boolean; thoughtSignature?: unknown; functionCall?: { name?: string; args?: unknown } };
type GeminiFrame = { candidates?: Array<{ finishReason?: string; content?: { parts?: GeminiPart[] } }>; error?: unknown };

export async function readGeminiToolCompletion(body: ReadableStream<Uint8Array>): Promise<ChatToolCompletion> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let text = "";
  let finishReason: string | null = null;
  let bad: "invalid_tool_call" | "invalid_tool_arguments" | null = null;
  const calls: Array<{ name: string; args: Record<string, unknown>; signature: string; thoughtSignature?: string }> = [];
  const modelParts: GeminiModelPart[] = [];

  const frame = (raw: string): void => {
    if (bad) return;
    const data = raw.split(/\r?\n/).filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) return;
    let payload: GeminiFrame;
    try {
      payload = JSON.parse(data) as GeminiFrame;
    } catch {
      bad = "invalid_tool_call";
      return;
    }
    if (!payload || typeof payload !== "object" || payload.error) { bad = "invalid_tool_call"; return; }
    const candidate = payload.candidates?.[0];
    if (!candidate) return;
    if (candidate.finishReason) {
      if (finishReason && finishReason !== candidate.finishReason) { bad = "invalid_tool_call"; return; }
      finishReason = candidate.finishReason;
    }
    for (const part of candidate.content?.parts ?? []) {
      if (!part || typeof part !== "object") { bad = "invalid_tool_call"; return; }
      // Gemini thinking signatures are opaque provider bytes encoded as strings.
      // Never synthesize a signature, expose it as assistant prose, or drop it
      // when reconstructing the model turn after executing registered tools.
      if (part.thoughtSignature !== undefined &&
          (typeof part.thoughtSignature !== "string" ||
           !part.thoughtSignature || part.thoughtSignature.length > MAX_THOUGHT_SIGNATURE)) {
        bad = "invalid_tool_call"; return;
      }
      const thoughtSignature = part.thoughtSignature as string | undefined;
      if (typeof part.text === "string") {
        if (!part.thought) text += part.text;
        if (text.length > MAX_TEXT) { bad = "invalid_tool_call"; return; }
        modelParts.push({
          text: part.text,
          ...(part.thought === true ? { thought: true } : {}),
          ...(thoughtSignature ? { thoughtSignature } : {}),
        });
      }
      if (!part.functionCall) continue;
      const { name, args } = part.functionCall;
      if (!name || !/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(name)) {
        bad = "invalid_tool_call"; return;
      }
      if (!args || typeof args !== "object" || Array.isArray(args)) {
        bad = "invalid_tool_arguments"; return;
      }
      const signature = JSON.stringify(args);
      if (signature.length > MAX_ARGUMENTS) { bad = "invalid_tool_arguments"; return; }
      const prior = calls.find((call) => call.name === name);
      if (prior) {
        // A streamed snapshot can repeat the same function call. Divergent
        // args for the same tool name are ambiguous: execute neither.
        if (prior.signature !== signature ||
            (prior.thoughtSignature && thoughtSignature && prior.thoughtSignature !== thoughtSignature)) {
          bad = "invalid_tool_arguments"; return;
        }
        if (thoughtSignature && !prior.thoughtSignature) {
          prior.thoughtSignature = thoughtSignature;
          const saved = modelParts.find((p) => p.functionCall?.name === name);
          if (saved) saved.thoughtSignature = thoughtSignature;
        }
        continue;
      }
      if (calls.length >= MAX_CALLS) { bad = "invalid_tool_call"; return; }
      calls.push({ name, args: args as Record<string, unknown>, signature,
        ...(thoughtSignature ? { thoughtSignature } : {}) });
      modelParts.push({ functionCall: { name, args: args as Record<string, unknown> },
        ...(thoughtSignature ? { thoughtSignature } : {}) });
    }
  };
  try {
    while (true) {
      let result: Awaited<ReturnType<typeof reader.read>>;
      try {
        result = await reader.read();
        buffer += result.done ? decoder.decode() : decoder.decode(result.value, { stream: true });
      } catch {
        bad = "invalid_tool_call"; break;
      }
      let delimiter: RegExpExecArray | null;
      while ((delimiter = /\r?\n\r?\n/.exec(buffer)) !== null) {
        frame(buffer.slice(0, delimiter.index));
        buffer = buffer.slice(delimiter.index + delimiter[0].length);
        if (bad) break;
      }
      if (bad || result.done) break;
      if (buffer.length > MAX_EVENT) { bad = "invalid_tool_call"; break; }
    }
    if (!bad && buffer.trim()) frame(buffer);
    if (bad) return invalid(bad);
    // Gemini normally closes the body after a STOP finish reason.
    if (finishReason !== "STOP") return invalid("invalid_tool_call");
    return {
      text,
      toolCalls: calls.map((call, index) => ({
        id: `gemini-call-${crypto.randomUUID()}-${index}`, name: call.name, arguments: call.args,
        ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
      })),
      finishReason,
      ...(calls.length ? { geminiParts: modelParts } : {}),
    };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
