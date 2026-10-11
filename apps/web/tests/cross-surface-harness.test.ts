import { describe, expect, it } from "vitest";
import { CROSS_SURFACE_SCENARIOS } from "../src/e2e/fixtures/cross-surface-scenarios";
import { runCrossSurfaceScenario } from "../src/e2e/cross-surface-harness";

describe("cross-surface deterministic E2E harness", () => {
  it("runs a fixture scenario with its stable idempotency key", async () => {
    const calls: string[] = [];
    const result = await runCrossSurfaceScenario("email-approval-send", [
      {
        name: "create approval",
        execute: (context) => {
          calls.push(context.idempotencyKey);
        },
      },
      {
        name: "retry approval",
        execute: (context) => {
          calls.push(context.idempotencyKey);
        },
      },
    ]);

    expect(result.scenarioId).toBe("email-approval-send");
    expect(result.idempotencyKey).toBe("e2e-email-action-001");
    expect(result.completedSteps).toEqual(["create approval", "retry approval"]);
    expect(calls).toEqual(["e2e-email-action-001", "e2e-email-action-001"]);
  });

  it("keeps the fixture catalogue deterministic and unique", () => {
    const ids = CROSS_SURFACE_SCENARIOS.map((scenario) => scenario.id);
    const keys = CROSS_SURFACE_SCENARIOS.map((scenario) => scenario.idempotencyKey);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(CROSS_SURFACE_SCENARIOS.length).toBeGreaterThanOrEqual(5);
  });
});
