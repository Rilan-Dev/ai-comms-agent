import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOGUE, SYSTEM_ROLE_PERMISSIONS, EMAIL_TOOL_CATALOG } from "@ai-comms-agent/shared";
import { readFileSync } from "node:fs";

const route = readFileSync(
  new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8",
);

describe("email.write identity permission contract", () => {
  it("declares the permission required by registered draft and approval tools", () => {
    const names = PERMISSION_CATALOGUE.map(permission => permission.name);
    expect(names).toContain("email.read");
    expect(names).toContain("email.write");
    expect(new Set(names).size).toBe(names.length);
    for (const name of ["email.draft.create", "email.draft.update", "email.send.request"]) {
      expect(EMAIL_TOOL_CATALOG.find(tool => tool.name === name)?.required_permission).toBe("email.write");
    }
  });

  it("grants draft and approval-request authority to trusted owner/admin roles by default", () => {
    expect(SYSTEM_ROLE_PERMISSIONS.owner).toContain("email.write");
    expect(SYSTEM_ROLE_PERMISSIONS.admin).toContain("email.write");
    expect(SYSTEM_ROLE_PERMISSIONS.member).not.toContain("email.write");
    expect(SYSTEM_ROLE_PERMISSIONS.viewer).not.toContain("email.write");
    for (const role of ["owner", "admin"] as const) {
      expect(SYSTEM_ROLE_PERMISSIONS[role]).toContain("email.read");
    }
  });

  it("role permission alone does not bypass agent policy, mailbox binding, or send approval", () => {
    expect(route).toContain('trusted.subject.permissions.has("email.write")');
    expect(route).toContain('runtime.registry.listForAgent(agentId)');
    expect(route).toContain("const bound = await primaryMailboxes(organizationId, agentId)");
    expect(route).toContain("invokeEmailReadTool(runtime, toolName, input, context)");
    expect(route).toContain('action === "draft" ? "draft_created" : "pending_approval"');
    expect(route).not.toContain("sendDraft(");
  });

  it("the compose UI preflight checks the actual authenticated user and registered tools", () => {
    expect(route).toContain('trusted.subject.permissions.has("email.write")');
    expect(route).toContain('allowed.some(tool => tool.name === "email.draft.create")');
    expect(route).toContain('allowed.some(tool => tool.name === "email.send.request")');
    expect(route).toContain("invokeEmailReadTool(runtime, toolName, input, context)");
    expect(route).toContain('output.status !== expected');
    expect(route).not.toContain("SYSTEM_ROLE_PERMISSIONS.owner.includes");
  });
});
