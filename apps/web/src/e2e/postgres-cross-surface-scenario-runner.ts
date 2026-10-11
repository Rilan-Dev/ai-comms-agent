import { runCrossSurfaceScenario, type CrossSurfaceHarnessResult } from "./cross-surface-harness";
import { createPostgresCrossSurfaceSteps, type PostgresCrossSurfaceFixture } from "./postgres-cross-surface-adapters";
import type { CrossSurfaceScenarioId } from "./fixtures/cross-surface-scenarios";

export async function runPostgresCrossSurfaceScenario(
  scenarioId: CrossSurfaceScenarioId,
  fixture: PostgresCrossSurfaceFixture,
): Promise<CrossSurfaceHarnessResult> {
  const steps = createPostgresCrossSurfaceSteps(fixture);
  return runCrossSurfaceScenario(scenarioId, steps);
}
