import type { GeminiModelPart, ToolChatMessage } from "./types";

/** Gemini requires original model parts (including opaque thoughtSignature)
 * in the following turn. The host executes ONLY registered tool calls; these
 * provider bytes never become executable instructions or client-side output.
 */
export function toGeminiToolContents(messages: ToolChatMessage[]): Array<{
  role: "model" | "user";
  parts: Array<GeminiModelPart | { functionResponse: { name: string; response: { result: string } } }>;
}> {
  const contents: Array<{
    role: "model" | "user";
    parts: Array<GeminiModelPart | { functionResponse: { name: string; response: { result: string } } }>;
  }> = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "tool") {
      const response = { functionResponse: { name: message.name, response: { result: message.content } } };
      const previous = contents[contents.length - 1];
      // One Gemini parallel function-call turn is answered by one user turn
      // with one functionResponse part per validated host tool result.
      if (previous?.role === "user" && previous.parts.every(p => "functionResponse" in p)) {
        previous.parts.push(response);
      } else {
        contents.push({ role: "user", parts: [response] });
      }
      continue;
    }
    if (message.role === "assistant" && "tool_calls" in message && message.tool_calls?.length) {
      const calls = message.tool_calls;
      if (message.geminiParts?.length) {
        const originalCalls = message.geminiParts.filter(p => p.functionCall).map(p => p.functionCall!);
        if (originalCalls.length !== calls.length || originalCalls.some((call, index) =>
          call.name !== calls[index]?.name ||
          JSON.stringify(call.args) !== JSON.stringify(calls[index]?.arguments))) {
          throw new Error("Gemini signed model parts do not match the validated tool decision.");
        }
        contents.push({ role: "model", parts: message.geminiParts });
      } else {
        contents.push({ role: "model", parts: calls.map(call => ({
          functionCall: { name: call.name, args: call.arguments },
          ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
        })) });
      }
      continue;
    }
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content ?? "" }],
    });
  }
  return contents;
}
