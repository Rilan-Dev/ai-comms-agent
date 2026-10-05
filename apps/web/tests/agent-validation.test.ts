import { describe, expect, it } from "vitest";
import { validateAgentInput, slugifyAgentName, validateAgentVersionConfig } from "@/lib/agents/validation";

describe("agent validation", () => {
  it("accepts a valid agent payload", () => {
    expect(validateAgentInput({
      name: "Operations Assistant",
      slug: "operations-assistant",
      description: "Handles internal follow-up.",
    })).toEqual({
      ok: true,
      value: {
        name: "Operations Assistant",
        slug: "operations-assistant",
        description: "Handles internal follow-up.",
      },
      fieldErrors: {},
    });
  });

  it("rejects invalid names and slugs with field-level errors", () => {
    const result = validateAgentInput({
      name: " ",
      slug: "Bad Slug!",
      description: "",
    });

    expect(result.ok).toBe(false);
    expect(result.fieldErrors.name).toBe("Agent name is required.");
    expect(result.fieldErrors.slug).toMatch(/lowercase/);
  });

  it("derives a stable URL-safe slug from a name", () => {
    expect(slugifyAgentName("  My AI — Operations  ")).toBe("my-ai-operations");
  });
});


describe("agent version configuration validation", () => {
  it("accepts a JSON object and rejects arrays", () => {
    expect(validateAgentVersionConfig({ model: "default", temperature: 0.7 })).toEqual({ ok: true, value: { model: "default", temperature: 0.7 } });
    expect(validateAgentVersionConfig([])).toEqual({ ok: false, message: "Version configuration must be a JSON object." });
  });

  it("rejects oversized configuration payloads", () => {
    const result = validateAgentVersionConfig({ prompt: "x".repeat(100_001) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/100 KB/);
  });
});
