import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runtime = readFileSync(resolve(__dirname, "../../../packages/agent-core/src/runtime.ts"), "utf8");

describe("Agent provider resolution", () => {
  it("still resolves per-agent provider overrides when organization runtime defaults are absent", () => {
    expect(runtime).toContain("const settings = settingsResult.rows[0] ?? {");
    expect(runtime).toContain("const agentResult = await query");
    expect(runtime).toContain("FROM agent_ai_settings WHERE organization_id=$1 AND agent_id=$2");
    expect(runtime).toContain("const effectiveProvider = (agentOverrides?.chatProvider");
    expect(runtime).not.toContain("const settings = settingsResult.rows[0];\n  if (!settings) return null;");
  });
});
