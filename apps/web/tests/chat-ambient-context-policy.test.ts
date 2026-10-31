import { describe, expect, it } from "vitest";
import { canSupplyAmbientContext } from "../src/lib/ai/ambient-context-access";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/app/api/chat/stream/route.ts", import.meta.url), "utf8");
const emailSearch = { name: "email.search", required_permission: "email.read" };
const emailList = { name: "email.messages.list", required_permission: "email.read" };
const whatsappHistory = { name: "whatsapp.history", required_permission: "whatsapp.read" };

describe("Chat ambient mailbox and WhatsApp context is not an authorization shortcut", () => {
  it("denies WhatsApp history if the actor lacks whatsapp.read even when the agent has the tool", () => {
    expect(canSupplyAmbientContext("whatsapp", new Set(["organization.read"]), [whatsappHistory])).toBe(false);
    expect(canSupplyAmbientContext("whatsapp", new Set(["whatsapp.send"]), [whatsappHistory])).toBe(false);
  });

  it("denies email bodies if the actor lacks email.read even when the agent permits search", () => {
    expect(canSupplyAmbientContext("email", new Set(["organization.read"]), [emailSearch])).toBe(false);
    expect(canSupplyAmbientContext("email", new Set(["email.write"]), [emailList])).toBe(false);
  });

  it("denies either context without an agent-granted read tool", () => {
    expect(canSupplyAmbientContext("email", new Set(["email.read"]), [])).toBe(false);
    expect(canSupplyAmbientContext("whatsapp", new Set(["whatsapp.read"]), [])).toBe(false);
  });

  it("accepts only supported, correctly permissioned read tools", () => {
    expect(canSupplyAmbientContext("email", new Set(["email.read"]), [emailSearch])).toBe(true);
    expect(canSupplyAmbientContext("email", new Set(["email.read"]), [emailList])).toBe(true);
    expect(canSupplyAmbientContext("whatsapp", new Set(["whatsapp.read"]), [whatsappHistory])).toBe(true);
    expect(canSupplyAmbientContext("email", new Set(["email.read"]), [whatsappHistory])).toBe(false);
    expect(canSupplyAmbientContext("whatsapp", new Set(["whatsapp.read"]), [emailSearch])).toBe(false);
    expect(canSupplyAmbientContext("whatsapp", new Set(["whatsapp.read"]), [{ name: "whatsapp.send", required_permission: "whatsapp.send" }])).toBe(false);
    expect(canSupplyAmbientContext("email", new Set(["email.read"]), [{ name: "email.search", required_permission: "whatsapp.read" }])).toBe(false);
  });

  it("gates both ambient queries before constructing model system messages", () => {
    const context = route.slice(route.indexOf("const combinedSearchContext = "), route.indexOf("await appendConversationMessage(", route.indexOf("const combinedSearchContext = ")));
    expect(context).toContain('canSupplyAmbientContext("email", subject.permissions');
    expect(context).toContain('canSupplyAmbientContext("whatsapp", subject.permissions');
    expect(context).toContain("createEmailToolRuntime(organizationId, agentId)");
    expect(context).toContain("createWhatsAppToolRuntime(organizationId, agentId)");
    expect(context).toContain("loadEmailContext(organizationId, agentId, combinedSearchContext,trustedToolContext)");
    expect(context).toContain("loadWhatsAppContext(organizationId, agentId, combinedSearchContext,trustedToolContext)");
    expect(context).toContain('turnAllowsTool(trustedToolContext,tool.name)');
    expect(context.indexOf('canSupplyAmbientContext("email"')).toBeLessThan(context.indexOf("loadEmailContext("));
    expect(context.indexOf('canSupplyAmbientContext("whatsapp"')).toBeLessThan(context.indexOf("loadWhatsAppContext("));
  });
});
