import { describe, expect, it, vi } from "vitest";
import { ToolRegistry } from "../../../packages/shared/src/agent/registry";
import type { Tool } from "../../../packages/shared/src/agent/types";

function makeTool(name = "kb.search"): Tool {
  return {
    name,
    domain: "kb",
    description: "Search authorized knowledge.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 50, enum: ["mail", "files"] } },
      required: ["query"],
      additionalProperties: false,
    },
    sensitivity: "safe",
    required_permission: "kb.read",
    execute: vi.fn(async () => ({
      ok: true,
      output: { count: 0 },
      audit: { tool_name: name, input_summary: "query", output_summary: "0 results", duration_ms: 1 },
    })),
  };
}

describe("ToolRegistry", () => {
  it("validates required fields, types and unexpected properties", () => {
    const registry = new ToolRegistry(() => ["kb.search"]);
    registry.register(makeTool());
    expect(registry.validate("kb.search", { query: "mail" })).toEqual({ valid: true });
    expect(registry.validate("kb.search", {})).toMatchObject({ valid: false });
    expect(registry.validate("kb.search", { query: 12 })).toMatchObject({ valid: false });
    expect(registry.validate("kb.search", { query: "unknown" })).toMatchObject({ valid: false });
    expect(registry.validate("kb.search", { query: "mail", extra: true })).toMatchObject({ valid: false });
  });

  it("fails closed when agent allowlist configuration is missing", () => {
    const registry = new ToolRegistry(() => null);
    registry.register(makeTool());
    expect(registry.listForAgent("agent-1")).toEqual([]);
  });

  it("filters tool discovery by agent allowlist and rejects duplicates", () => {
    const registry = new ToolRegistry(() => ["kb.search"]);
    registry.register(makeTool());
    expect(registry.listForAgent("agent-1").map((tool) => tool.name)).toEqual(["kb.search"]);
    expect(() => registry.register(makeTool())).toThrow(/already registered/);
  });
});
