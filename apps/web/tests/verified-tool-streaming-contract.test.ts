import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (relative: string) => readFileSync(resolve(__dirname, relative), "utf8");
const runtime = read("../../../packages/clara-core/src/runtime.ts");
const chat = read("../src/app/api/chat/stream/route.ts");
const voice = read("../src/app/api/voice/turn/route.ts");
const loop = read("../../../packages/email-agent-runtime/src/email-agent-loop.ts");
const verifier = read("../src/lib/streaming/verified-tool-answer.ts");

describe("authorized tool result progressive model delivery", () => {
  it("uses native provider streaming without exposing tool APIs in the final answer delivery pass", () => {
    const method = runtime.slice(runtime.indexOf("async streamCanonicalToolAnswer("), runtime.indexOf("async completeWithTools("));
    expect(method).toContain("organizationAIConfig(ctx.orgId, ctx.agentId)");
    expect(method).toContain("chatStream(configuration");
    expect(method).not.toContain("chatWithTools(");
    expect(method).toContain("temperature: 0");
    expect(method).toContain("canonical.length > 6000");
  });
  it("only exposes verified chunks of an authorized canonical answer", () => {
    expect(verifier).toContain("canonical.startsWith(chunk, matched)");
    expect(verifier).toContain('mode: providerComplete ? "verified-provider-tokens" : "canonical-fallback"');
    expect(verifier).toContain("if (matched < canonical.length) emitDelta(canonical.slice(matched))");
    expect(verifier).toContain("if (signal?.aborted)");
  });
  it("Chat marks read-only tool eligibility from registered host permissions, not model-supplied names", () => {
    expect(chat).toContain("visibleTools.find((entry) => entry.name === call.name)");
    expect(chat).toContain('registeredTool.required_permission === "email.read"');
    expect(chat).toContain('registeredTool.required_permission === "whatsapp.read"');
    expect(chat).toContain('registeredTool?.sensitivity === "safe"');
    expect(chat).toContain("toolTurn.toolCalls.every((call) => call.ok && call.readOnly === true)");
    expect(chat).toContain("emitVerifiedToolAnswer(");
  });
  it("Voice only regenerates read-only completed approvals-free tool answers", () => {
    expect(loop).toContain("registered.find((entry) => entry.name === call.name)");
    expect(loop).toContain("registeredTool.required_permission === \"email.read\"");
    expect(voice).toContain('result.finishReason === "completed"');
    expect(voice).toContain("result.pendingApprovals.length === 0");
    expect(voice).toContain("result.toolCalls.every((call) => call.ok && call.readOnly === true)");
    expect(voice).toContain("emitVerifiedToolAnswer(");
    expect(voice).toContain('mode: "host-authorized-tools"');
    expect(voice).toContain("return NextResponse.json({"); // legacy clients remain compatible
  });
  it("keeps writes, denials, and approval-required results canonical", () => {
    expect(chat).toContain("Denied, write/approval, empty-tool or limit-stop");
    expect(voice).toContain("Approval-required and denied/write outcomes retain the");
    expect(voice).toContain('emit("delta", { text: result.text })');
    expect(chat).toContain('emit("delta", { text: assistantOutput })');
  });
});
