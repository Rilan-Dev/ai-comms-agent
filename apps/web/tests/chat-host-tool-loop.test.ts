import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(resolve(__dirname, "../src/app/api/chat/stream/route.ts"), "utf8");

describe("interactive chat host-authorized tool loop", () => {
  it("constructs tool context from the authenticated subject, not model arguments", () => {
    expect(route).toContain("const trustedToolContext: ToolContext");
    expect(route).toContain("user_id: subject.user.id");
    expect(route).toContain("role: subject.membership.role");
    expect(route).toContain("permissions: [...subject.permissions]");
    expect(route).toContain("toolContext: trustedToolContext");
  });

  it("fails closed and narrows nullable membership before creating trusted tool context", () => {
    const membershipGuard = route.indexOf("if (!subject.membership)");
    const trustedContext = route.indexOf("const trustedToolContext: ToolContext");
    expect(membershipGuard).toBeGreaterThanOrEqual(0);
    expect(route).toContain('message: "An active organization membership is required."');
    expect(route).toContain("{ status: 403 }");
    expect(trustedContext).toBeGreaterThan(membershipGuard);
  });

  it("uses only registered and allowlisted email and WhatsApp tools", () => {
    expect(route).toContain("emailRuntime.registry.listForAgent(args.agentId)");
    expect(route).toContain("whatsappRuntime.registry.listForAgent(args.agentId)");
    expect(route).toContain("args.toolContext.auth_subject.permissions.includes(tool.required_permission)");
    expect(route).toContain("invokeWhatsAppTool(whatsappRuntime, call.name, call.arguments, args.toolContext)");
    expect(route).toContain("invokeEmailReadTool(emailRuntime, call.name, call.arguments, args.toolContext)");
  });

  it("bounds tool execution and treats tool results as untrusted", () => {
    expect(route).toContain("const MAX_HOST_TOOL_ROUNDS = 6");
    expect(route).toContain("const MAX_HOST_TOOL_CALLS = 12");
    expect(route).toContain("MAX_HOST_TOOL_RESULT_CHARS = 10000");
    expect(route).toContain("UNTRUSTED TOOL RESULT");
  });

  it("lets safe read-only discovery chains finish before generating the final answer", () => {
    // Regression for the "no inbox contents were provided" chat answer: the
    // loop must NOT terminate after the first round of safe read-only calls
    // (e.g. email.accounts.list); it must keep iterating until the model
    // stops requesting tools so it can chain email.messages.list with the
    // discovered account_id.
    expect(route).not.toContain("round === 0 && args.onSafeReadOnlyFinal");
    const stopBranch = route.indexOf("completion.toolCalls.length === 0");
    const writerCall = route.indexOf("await args.onSafeReadOnlyFinal(history)");
    const chainGuidance = route.indexOf("discovery chains such as email.accounts.list -> email.messages.list");
    expect(stopBranch).toBeGreaterThanOrEqual(0);
    expect(writerCall).toBeGreaterThan(stopBranch);
    expect(chainGuidance).toBeGreaterThan(stopBranch);
    // The model's own stopping-round text wins over regenerating the answer.
    expect(route).toContain("args.onSafeReadOnlyFinal && !completion.text.trim()");
    expect(route).toContain('return { text: completion.text.trim() || "I couldn\'t complete that request safely. Please try again.", toolCalls: summaries };');
  });

  it("does not register or invoke WhatsApp send from the interactive chat loop", () => {
    expect(route).not.toContain("createWhatsAppSendTool");
    expect(route).not.toContain('name: "whatsapp.send"');
    expect(route).toContain("createWhatsAppToolRuntime");
  });
});
