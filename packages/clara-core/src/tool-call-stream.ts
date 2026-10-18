import type { ChatToolCompletion } from "./types";

/**
 * OpenAI-compatible Chat Completions SSE: tool calls arrive in fragments.
 *
 * NEVER emit fragments to a host tool executor. Only a fully terminated
 * provider response with valid IDs, names and JSON object arguments yields
 * executable tool calls. All other cases fail closed without leaking raw
 * provider arguments or a partially parsed action.
 */
const MAX_FRAME_BYTES = 256_000;
const MAX_TEXT_CHARS = 64_000;
const MAX_ARGUMENT_CHARS = 16_000;
const MAX_TOOL_CALLS = 32;

type DeltaCall = {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};
type DeltaEvent = {
  choices?: Array<{
    finish_reason?: string | null;
    delta?: { content?: string | null; tool_calls?: DeltaCall[] };
  }>;
  error?: unknown;
};
type PartialCall = { id: string; name: string; arguments: string };

const invalid = (reason: "invalid_tool_call" | "invalid_tool_arguments"): ChatToolCompletion => ({
  text: "I couldn't safely interpret the requested operation, so I did not execute it. Please rephrase the request.",
  toolCalls: [],
  finishReason: reason,
});

export async function readOpenAIToolCompletion(
  body: ReadableStream<Uint8Array>,
): Promise<ChatToolCompletion> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const calls = new Map<number, PartialCall>();
  let buffer = "";
  let text = "";
  let finishReason: string | null = null;
  let sawDone = false;
  let bad: "invalid_tool_call" | "invalid_tool_arguments" | null = null;

  const processFrame = (frame: string): void => {
    if (bad || sawDone) return;
    const data = frame.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    if (data.trim() === "[DONE]") {
      sawDone = true;
      return;
    }
    let payload: DeltaEvent;
    try {
      payload = JSON.parse(data) as DeltaEvent;
    } catch {
      bad = "invalid_tool_call";
      return;
    }
    if (!payload || typeof payload !== "object" || payload.error) {
      bad = "invalid_tool_call";
      return;
    }
    const item = payload.choices?.[0];
    if (!item) return; // Token usage events can have no choices.
    if (item.finish_reason != null) {
      if (finishReason && item.finish_reason !== finishReason) {
        bad = "invalid_tool_call";
        return;
      }
      finishReason = item.finish_reason;
    }
    const delta = item.delta;
    if (!delta) return;
    if (typeof delta.content === "string") {
      text += delta.content;
      if (text.length > MAX_TEXT_CHARS) bad = "invalid_tool_call";
    }
    for (const part of delta.tool_calls ?? []) {
      const index = part.index;
      if (!Number.isInteger(index) || index! < 0 || index! >= MAX_TOOL_CALLS ||
          part.type && part.type !== "function") {
        bad = "invalid_tool_call";
        return;
      }
      const current = calls.get(index!) ?? { id: "", name: "", arguments: "" };
      if (part.id !== undefined) {
        if (typeof part.id !== "string") { bad = "invalid_tool_call"; return; }
        current.id += part.id;
      }
      if (part.function?.name !== undefined) {
        if (typeof part.function.name !== "string") { bad = "invalid_tool_call"; return; }
        current.name += part.function.name;
      }
      if (part.function?.arguments !== undefined) {
        if (typeof part.function.arguments !== "string") { bad = "invalid_tool_arguments"; return; }
        current.arguments += part.function.arguments;
      }
      if (current.id.length > 128 || current.name.length > 128 || current.arguments.length > MAX_ARGUMENT_CHARS) {
        bad = "invalid_tool_arguments";
        return;
      }
      calls.set(index!, current);
    }
  };

  try {
    while (true) {
      let result: Awaited<ReturnType<typeof reader.read>>;
      try {
        result = await reader.read();
        buffer += result.done ? decoder.decode() : decoder.decode(result.value, { stream: true });
      } catch {
        bad = "invalid_tool_call";
        break;
      }
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer)) !== null) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        processFrame(frame);
        if (bad || sawDone) break;
      }
      if (bad || sawDone || result.done) break;
      if (buffer.length > MAX_FRAME_BYTES) { bad = "invalid_tool_call"; break; }
    }
    if (!bad && !sawDone && buffer.trim()) processFrame(buffer);
    if (bad) return invalid(bad);
    if (!sawDone || !finishReason) return invalid("invalid_tool_call");
    if (calls.size === 0) {
      if (finishReason !== "stop") return invalid("invalid_tool_call");
      return { text, toolCalls: [], finishReason };
    }
    if (finishReason !== "tool_calls") return invalid("invalid_tool_call");
    const toolCalls: ChatToolCompletion["toolCalls"] = [];
    const entries = [...calls].sort(([a], [b]) => a - b);
    for (let index = 0; index < entries.length; index++) {
      const [actualIndex, item] = entries[index]!;
      if (actualIndex !== index || !item.id || !/^[\w-]{1,128}$/.test(item.id) ||
          !/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(item.name)) {
        return invalid("invalid_tool_call");
      }
      let args: unknown;
      try {
        args = JSON.parse(item.arguments);
      } catch {
        return invalid("invalid_tool_arguments");
      }
      if (args === null || typeof args !== "object" || Array.isArray(args)) {
        return invalid("invalid_tool_arguments");
      }
      toolCalls.push({ id: item.id, name: item.name, arguments: args as Record<string, unknown> });
    }
    if (new Set(toolCalls.map((call) => call.id)).size !== toolCalls.length) return invalid("invalid_tool_call");
    return { text, toolCalls, finishReason };
  } finally {
    // A provider can send [DONE] before HTTP EOF. Cancel even on success
    // so no paused upstream body keeps sockets or model generation alive.
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
