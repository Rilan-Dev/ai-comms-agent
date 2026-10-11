import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(__dirname, "../src/app/api/chat/stream/route.ts");
const routeSource = readFileSync(routePath, "utf8");

describe("chat authorization boundary", () => {
  it("resolves the requested agent inside the authenticated organization before conversation access", () => {
    const agentLookup = routeSource.indexOf("new PostgresAgentRepository().get(organizationId, agentId)");
    const conversationLookup = routeSource.indexOf("getChatConversation(organizationId, requestedConversationId, agentId)");
    const conversationCreate = routeSource.indexOf("getOrCreateChatConversation(organizationId, agentId)");

    expect(agentLookup).toBeGreaterThanOrEqual(0);
    expect(conversationLookup).toBeGreaterThanOrEqual(0);
    expect(conversationCreate).toBeGreaterThanOrEqual(0);
    expect(agentLookup).toBeLessThan(conversationLookup);
    expect(agentLookup).toBeLessThan(conversationCreate);
  });

  it("fails closed when the requested agent is absent from the organization", () => {
    expect(routeSource).toContain('error: "not_found"');
    expect(routeSource).toContain("Agent was not found in this organization.");
  });
});
