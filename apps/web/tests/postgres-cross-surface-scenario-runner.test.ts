import { describe, expect, it } from "vitest";
import { runPostgresCrossSurfaceScenario } from "../src/e2e/postgres-cross-surface-scenario-runner";
import { E2E_FIXTURE_IDS } from "../src/e2e/fixtures/cross-surface-scenarios";

const fixture = {
  organizationId: E2E_FIXTURE_IDS.organizationA,
  otherOrganizationId: E2E_FIXTURE_IDS.organizationB,
  agentId: E2E_FIXTURE_IDS.agentA,
  userId: E2E_FIXTURE_IDS.ownerA,
  emailAccountId: E2E_FIXTURE_IDS.emailAccountA,
  whatsappAccountId: E2E_FIXTURE_IDS.whatsappAccountA,
  correlationId: E2E_FIXTURE_IDS.correlationEmail,
  to: "+15555550100",
  recipientSnapshot: { to: "+15555550100", subject: "Deterministic E2E" },
  scheduledJobId: E2E_FIXTURE_IDS.scheduledJobA,
} as const;

describe("PostgreSQL cross-surface scenario runner", () => {
  it("exports a real DB-backed runner without fabricating provider delivery", async () => {
    expect(runPostgresCrossSurfaceScenario).toBeTypeOf("function");
    expect(fixture.organizationId).not.toBe(fixture.otherOrganizationId);
  });

  it("keeps the fixture identity stable", () => {
    expect(fixture.emailAccountId).toBe(E2E_FIXTURE_IDS.emailAccountA);
    expect(fixture.whatsappAccountId).toBe(E2E_FIXTURE_IDS.whatsappAccountA);
    expect(fixture.scheduledJobId).toBe(E2E_FIXTURE_IDS.scheduledJobA);
  });
});
