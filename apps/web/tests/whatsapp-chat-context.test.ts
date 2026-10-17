import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(resolve(__dirname, "../src/app/api/chat/stream/route.ts"), "utf8");

describe("agent-bound WhatsApp chat context", () => {
  it("only loads WhatsApp context for WhatsApp-related prompts", () => {
    expect(route).toContain("function asksAboutWhatsApp(content: string)");
    expect(route).toContain("/\\bwhats\\s?app\\b/i.test(content)");
    expect(route).toContain("if (!asksAboutWhatsApp(content)) return null;");
  });

  it("requires a connected account explicitly bound to the current agent and organization", () => {
    expect(route).toContain("w.status = 'connected'");
    expect(route).toContain("w.deleted_at IS NULL");
    expect(route).toContain("JOIN agent_whatsapp_accounts b");
    expect(route).toContain("b.agent_id = $2");
    expect(route).toContain("a.organization_id = $1");
    expect(route).toContain("m.organization_id = $1");
  });

  it("treats WhatsApp messages as untrusted and does not imply send capability", () => {
    expect(route).toContain("<untrusted_whatsapp_content>");
    expect(route).toContain("This context is read-only");
    expect(route).toContain("whatsappContext ? [{ role: \"system\" as const, content: whatsappContext }]");
  });
});
