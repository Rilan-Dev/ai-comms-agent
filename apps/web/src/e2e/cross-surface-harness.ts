import { CROSS_SURFACE_SCENARIOS, type CrossSurfaceScenarioId } from "./fixtures/cross-surface-scenarios";

export type CrossSurfaceHarnessContext = {
  scenarioId: CrossSurfaceScenarioId;
  idempotencyKey: string;
};

export type CrossSurfaceHarnessStep = {
  name: string;
  execute: (context: CrossSurfaceHarnessContext) => Promise<void> | void;
};

export type CrossSurfaceHarnessResult = {
  scenarioId: CrossSurfaceScenarioId;
  idempotencyKey: string;
  completedSteps: string[];
};

export async function runCrossSurfaceScenario(
  scenarioId: CrossSurfaceScenarioId,
  steps: readonly CrossSurfaceHarnessStep[],
): Promise<CrossSurfaceHarnessResult> {
  const scenario = CROSS_SURFACE_SCENARIOS.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error(`Unknown cross-surface scenario: ${scenarioId}`);

  const context: CrossSurfaceHarnessContext = {
    scenarioId,
    idempotencyKey: scenario.idempotencyKey,
  };
  const completedSteps: string[] = [];

  for (const step of steps) {
    if (!step.name.trim()) throw new Error("Cross-surface harness step name is required");
    await step.execute(context);
    completedSteps.push(step.name);
  }

  return {
    scenarioId,
    idempotencyKey: context.idempotencyKey,
    completedSteps,
  };
}
