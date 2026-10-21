import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const chat = readFileSync(resolve(__dirname, "../src/app/api/chat/stream/route.ts"), "utf8");
const clara = readFileSync(resolve(__dirname, "../../../packages/clara-core/src/runtime.ts"), "utf8");
const emailWrite = readFileSync(resolve(__dirname, "../../../packages/email-agent-runtime/src/email-write-tools.ts"), "utf8");
const authorizer = readFileSync(resolve(__dirname, "../../../packages/email-agent-runtime/src/email-tool-runtime.ts"), "utf8");

describe("Sarvam-enabled agent email chat", () => {
  it("does not hide tool-provider errors behind a misleading text-only answer", () => {
    const start = chat.indexOf("async function runInteractiveHostToolLoop");
    const end = chat.indexOf("export async function POST", start);
    const hostLoop = chat.slice(start, end);
    expect(hostLoop).toContain("The selected AI provider could not execute this agent's tools.");
    expect(hostLoop).toContain("No email was sent or queued for approval.");
    expect(hostLoop).not.toContain('&& /(?:not supported|not enabled for Sarvam|unsupported native tool)/i.test(error.message)) return null');
  });

  it("uses the real Sarvam Chat V1 tool API and maps identifiers before host execution", () => {
    expect(clara).toContain('config.provider !== "openai" && config.provider !== "gemini" && config.provider !== "sarvam"');
    expect(clara).toContain('createSarvamToolBridge(tools.map((tool) => tool.name))');
    expect(clara).toContain('"api-subscription-key"');
    expect(clara).toContain("bridge.fromProvider(call.function.name)");
    expect(clara).toContain("stream: !sarvam");
    expect(clara).toContain("max_tokens: options.maxTokens");
    expect(clara).not.toContain("Native tool calling is not enabled for Sarvam until provider function-call semantics are verified.");
  });

  it("requires registered allowlisted tools, user authority, and human send approval", () => {
    expect(chat).toContain("createEmailToolRuntime(args.organizationId, args.agentId)");
    expect(chat).toContain("args.toolContext.auth_subject.permissions.includes(tool.required_permission)");
    expect(chat).toContain("invokeEmailReadTool(emailRuntime, call.name, call.arguments, args.toolContext)");
    expect(authorizer).toContain("isEmailToolAllowedByPolicy(currentPolicy, tool.name)");
    expect(emailWrite).toContain('makeTool("email.draft.create"');
    expect(emailWrite).toContain('makeTool("email.send.request"');
    expect(emailWrite).toContain('status: "pending_approval"');
    expect(emailWrite).not.toContain(".sendDraft(");
  });
});
